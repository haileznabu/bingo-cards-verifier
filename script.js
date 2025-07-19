class BingoAnalyzer {
  constructor() {
    this.dataset1 = null // Stores { id: number, data: int[][] }
    this.dataset2 = null // Stores { id: number, data: int[][] }
    this.shuffledDataset = null // Stores the result of shuffling

    this.initializeEventListeners()
  }

  initializeEventListeners() {
    document.getElementById("file1").addEventListener("change", (e) => this.handleFileUpload(e, 1))
    document.getElementById("file2").addEventListener("change", (e) => this.handleFileUpload(e, 2))
    document.getElementById("analyzeBtn").addEventListener("click", () => this.analyzeDataset())
    document.getElementById("compareBtn").addEventListener("click", () => this.compareDatasets())
    document.getElementById("clearBtn").addEventListener("click", () => this.clearAll())
    document.getElementById("shuffleBtn").addEventListener("click", () => this.shuffleCardIds())
  }

  async handleFileUpload(event, fileNumber) {
    const file = event.target.files[0]
    const infoElement = document.getElementById(`file${fileNumber}-info`)

    if (!file) {
      infoElement.textContent = ""
      return
    }

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const normalizedData = this.normalizeData(data)

      if (fileNumber === 1) {
        this.dataset1 = normalizedData
      } else {
        this.dataset2 = normalizedData
      }

      infoElement.innerHTML = `
                <strong>${file.name}</strong><br>
                ${normalizedData.length} cards loaded
            `

      this.updateButtonStates()
    } catch (error) {
      infoElement.innerHTML = `<span style="color: #dc3545;">Error: Invalid JSON file or unsupported format.</span>`
      console.error("File parsing error:", error)
    }
  }

  /**
   * Helper to convert a flat 24-number array to a 5x5 2D array with a FREE space (-1) at the center.
   */
  convertFlatTo2D(flatNumbers) {
    const card = Array(5)
      .fill(0)
      .map(() => Array(5).fill(0))
    let flatIndex = 0
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) {
          card[r][c] = -1 // FREE space
        } else {
          if (flatIndex < flatNumbers.length) {
            card[r][c] = flatNumbers[flatIndex]
            flatIndex++
          } else {
            // Handle case where flatNumbers might be less than 24 (shouldn't happen with valid data)
            console.warn("Not enough numbers in flat array to fill 5x5 card.")
            card[r][c] = 0 // Default to 0 or throw error
          }
        }
      }
    }
    return card
  }

  /**
   * Normalizes various JSON input formats into a consistent array of objects:
   * [{ id: number, data: int[][] }]
   */
  normalizeData(data) {
    const normalizedCards = []

    if (typeof data === "object" && !Array.isArray(data)) {
      // Case 1 & 2: Root is an object (keys are IDs)
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          const cardId = Number.parseInt(key, 10)
          if (isNaN(cardId)) {
            console.warn(`Skipping non-integer key in JSON object: ${key}`)
            continue
          }
          const cardContent = data[key]

          if (Array.isArray(cardContent)) {
            // Case 1: Old 2D array format
            if (cardContent.length === 5 && cardContent.every((row) => Array.isArray(row) && row.length === 5)) {
              normalizedCards.push({ id: cardId, data: cardContent })
            } else {
              console.warn(`Card ${cardId}: Invalid 2D array structure.`)
            }
          } else if (typeof cardContent === "object" && cardContent.hasOwnProperty("bingo_numbers")) {
            // Case 2: New flat array format within an object
            const flatNumbers = cardContent.bingo_numbers
            if (Array.isArray(flatNumbers) && flatNumbers.length === 24) {
              normalizedCards.push({ id: cardId, data: this.convertFlatTo2D(flatNumbers) })
            } else {
              console.warn(`Card ${cardId}: bingo_numbers is not a valid 24-element array.`)
            }
          } else {
            console.warn(`Card ${cardId}: Unknown card content format.`)
          }
        }
      }
    } else if (Array.isArray(data)) {
      // Case 3: Root is an array (each element is a card object)
      data.forEach((cardObject) => {
        if (
          typeof cardObject === "object" &&
          cardObject.hasOwnProperty("cartela_no") &&
          cardObject.hasOwnProperty("bingo_numbers")
        ) {
          const cardId = cardObject.cartela_no
          const flatNumbers = cardObject.bingo_numbers
          if (Array.isArray(flatNumbers) && flatNumbers.length === 24) {
            normalizedCards.push({ id: cardId, data: this.convertFlatTo2D(flatNumbers) })
          } else {
            console.warn(`Card with cartela_no ${cardId}: bingo_numbers is not a valid 24-element array.`)
          }
        } else {
          console.warn("Array element is not a valid card object (missing cartela_no or bingo_numbers).")
        }
      })
    } else {
      throw new Error("Unsupported JSON root format.")
    }

    // Sort by ID for consistent processing and display
    normalizedCards.sort((a, b) => a.id - b.id)
    return normalizedCards
  }

  updateButtonStates() {
    const analyzeBtn = document.getElementById("analyzeBtn")
    const compareBtn = document.getElementById("compareBtn")
    const shuffleBtn = document.getElementById("shuffleBtn")

    analyzeBtn.disabled = !this.dataset1
    compareBtn.disabled = !this.dataset1 || !this.dataset2
    shuffleBtn.disabled = !this.dataset1
  }

  showLoading() {
    document.getElementById("loading").classList.add("show")
  }

  hideLoading() {
    document.getElementById("loading").classList.remove("show")
  }

  async analyzeDataset() {
    if (!this.dataset1) return

    this.showLoading()

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const analysis = this.performAnalysis(this.dataset1)
        this.displayResults(analysis)
      } catch (error) {
        console.error("Analysis error:", error)
        this.displayError("Analysis failed. Please check your data format.")
      } finally {
        this.hideLoading()
      }
    }, 100)
  }

  async compareDatasets() {
    if (!this.dataset1 || !this.dataset2) return

    this.showLoading()

    setTimeout(() => {
      try {
        const comparison = this.performComparison(this.dataset1, this.dataset2)
        this.displayComparison(comparison)
      } catch (error) {
        console.error("Comparison error:", error)
        this.displayError("Comparison failed. Please check your data format.")
      } finally {
        this.hideLoading()
      }
    }, 100)
  }

  performAnalysis(dataset) {
    const analysis = {
      totalCards: dataset.length,
      validCards: 0,
      invalidCards: 0,
      duplicateCards: [],
      validationResults: [],
      numberDistribution: { B: {}, I: {}, N: {}, G: {}, O: {} },
      columnStats: { B: 0, I: 0, N: 0, G: 0, O: 0 },
      freeSpaceValidation: { correct: 0, incorrect: 0 },
      rangeValidation: { valid: 0, invalid: 0 },
      structureValidation: { valid: 0, invalid: 0 },
    }

    const cardHashes = new Map() // Stores hash -> original card ID
    const columns = ["B", "I", "N", "G", "O"]
    const ranges = [
      [1, 15],
      [16, 30],
      [31, 45],
      [46, 60],
      [61, 75],
    ]

    dataset.forEach((cardObj) => {
      const cardId = cardObj.id
      const card = cardObj.data // The 5x5 2D array
      let isValidCard = true
      const cardErrors = []

      // Structure validation
      if (!Array.isArray(card) || card.length !== 5 || !card.every((row) => Array.isArray(row) && row.length === 5)) {
        isValidCard = false
        cardErrors.push("Invalid card structure (not 5x5 array)")
        analysis.structureValidation.invalid++
      } else {
        analysis.structureValidation.valid++

        // Free space validation (center should be -1 or "FREE")
        const centerValue = card[2][2]
        if (centerValue === -1 || centerValue === "FREE") {
          analysis.freeSpaceValidation.correct++
        } else {
          analysis.freeSpaceValidation.incorrect++
          cardErrors.push("Invalid free space (center is not -1 or 'FREE')")
          isValidCard = false
        }

        // Number range and distribution validation
        let rangeValid = true
        const cardNumbers = new Set() // To check for duplicates within the card

        card.forEach((row, rowIndex) => {
          row.forEach((value, colIndex) => {
            if (rowIndex === 2 && colIndex === 2) return // Skip free space

            const column = columns[colIndex]
            const [min, max] = ranges[colIndex]

            if (typeof value === "number") {
              // Check for duplicates within card
              if (cardNumbers.has(value)) {
                cardErrors.push(`Duplicate number ${value} in card`)
                isValidCard = false
              } else {
                cardNumbers.add(value)
              }

              // Range validation
              if (value >= min && value <= max) {
                analysis.columnStats[column]++
                if (!analysis.numberDistribution[column][value]) {
                  analysis.numberDistribution[column][value] = 0
                }
                analysis.numberDistribution[column][value]++
              } else {
                rangeValid = false
                cardErrors.push(`Number ${value} out of range for column ${column} (${min}-${max})`)
              }
            } else {
              cardErrors.push(`Non-numeric value '${value}' found in card`)
              isValidCard = false
            }
          })
        })

        if (rangeValid) {
          analysis.rangeValidation.valid++
        } else {
          analysis.rangeValidation.invalid++
          isValidCard = false
        }

        // Duplicate card detection (based on content, not ID)
        const cardHash = this.generateCardHash(card)
        if (cardHashes.has(cardHash)) {
          analysis.duplicateCards.push({
            card1: cardHashes.get(cardHash), // Original ID of the first occurrence
            card2: cardId, // Current card's ID
            hash: cardHash,
          })
          isValidCard = false // Mark as invalid if it's a duplicate
        } else {
          cardHashes.set(cardHash, cardId)
        }
      }

      if (isValidCard) {
        analysis.validCards++
      } else {
        analysis.invalidCards++
        analysis.validationResults.push({
          cardNumber: cardId, // Use the actual card ID
          errors: cardErrors,
        })
      }
    })

    return analysis
  }

  generateCardHash(card) {
    // Ensure -1 is treated consistently as "FREE" for hashing
    return JSON.stringify(card.map((row) => row.map((val) => (val === -1 || val === "FREE" ? "FREE" : val))))
  }

  performComparison(dataset1, dataset2) {
    const analysis1 = this.performAnalysis(dataset1)
    const analysis2 = this.performAnalysis(dataset2)

    // Find common cards based on content hash
    const hashes1 = new Set()
    const hashes2 = new Set()

    dataset1.forEach((cardObj) => hashes1.add(this.generateCardHash(cardObj.data)))
    dataset2.forEach((cardObj) => hashes2.add(this.generateCardHash(cardObj.data)))

    const commonCards = [...hashes1].filter((hash) => hashes2.has(hash))
    const uniqueToDataset1 = [...hashes1].filter((hash) => !hashes2.has(hash))
    const uniqueToDataset2 = [...hashes2].filter((hash) => !hashes1.has(hash))

    return {
      dataset1: analysis1,
      dataset2: analysis2,
      commonCards: commonCards.length,
      uniqueToDataset1: uniqueToDataset1.length,
      uniqueToDataset2: uniqueToDataset2.length,
      totalUnique: hashes1.size + hashes2.size - commonCards.length,
    }
  }

  displayResults(analysis) {
    const resultsContainer = document.getElementById("results")

    resultsContainer.innerHTML = `
            <div class="result-section">
                <h2>📊 Dataset Overview</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${analysis.totalCards}</div>
                        <div class="stat-label">Total Cards</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.validCards}</div>
                        <div class="stat-label">Valid Cards</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.invalidCards}</div>
                        <div class="stat-label">Invalid Cards</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.duplicateCards.length}</div>
                        <div class="stat-label">Duplicate Pairs</div>
                    </div>
                </div>
            </div>

            <div class="result-section">
                <h2>✅ Validation Results</h2>
                <div class="validation-results">
                    <div class="validation-item ${analysis.structureValidation.invalid === 0 ? "valid" : "invalid"}">
                        <span class="validation-icon">${analysis.structureValidation.invalid === 0 ? "✅" : "❌"}</span>
                        <span class="validation-text">Card Structure</span>
                        <span class="validation-details">${analysis.structureValidation.valid} valid, ${analysis.structureValidation.invalid} invalid</span>
                    </div>
                    <div class="validation-item ${analysis.freeSpaceValidation.incorrect === 0 ? "valid" : "invalid"}">
                        <span class="validation-icon">${analysis.freeSpaceValidation.incorrect === 0 ? "✅" : "❌"}</span>
                        <span class="validation-text">Free Space Validation</span>
                        <span class="validation-details">${analysis.freeSpaceValidation.correct} correct, ${analysis.freeSpaceValidation.incorrect} incorrect</span>
                    </div>
                    <div class="validation-item ${analysis.rangeValidation.invalid === 0 ? "valid" : "invalid"}">
                        <span class="validation-icon">${analysis.rangeValidation.invalid === 0 ? "✅" : "❌"}</span>
                        <span class="validation-text">Number Range Validation</span>
                        <span class="validation-details">${analysis.rangeValidation.valid} valid, ${analysis.rangeValidation.invalid} invalid</span>
                    </div>
                    <div class="validation-item ${analysis.duplicateCards.length === 0 ? "valid" : "invalid"}">
                        <span class="validation-icon">${analysis.duplicateCards.length === 0 ? "✅" : "❌"}</span>
                        <span class="validation-text">Card Uniqueness</span>
                        <span class="validation-details">${analysis.duplicateCards.length} duplicate pairs found</span>
                    </div>
                </div>
            </div>

            <div class="result-section">
                <h2>📈 Number Distribution</h2>
                <div class="number-distribution">
                    <div class="column-stats">
                        <div class="column-header">B</div>
                        <div class="column-range">1-15</div>
                        <div class="column-count">${analysis.columnStats.B}</div>
                    </div>
                    <div class="column-stats">
                        <div class="column-header">I</div>
                        <div class="column-range">16-30</div>
                        <div class="column-count">${analysis.columnStats.I}</div>
                    </div>
                    <div class="column-stats">
                        <div class="column-header">N</div>
                        <div class="column-range">31-45</div>
                        <div class="column-count">${analysis.columnStats.N}</div>
                    </div>
                    <div class="column-stats">
                        <div class="column-header">G</div>
                        <div class="column-range">46-60</div>
                        <div class="column-count">${analysis.columnStats.G}</div>
                    </div>
                    <div class="column-stats">
                        <div class="column-header">O</div>
                        <div class="column-range">61-75</div>
                        <div class="column-count">${analysis.columnStats.O}</div>
                    </div>
                </div>
            </div>

            ${this.generateDuplicatesSection(analysis.duplicateCards)}
            ${this.generateErrorsSection(analysis.validationResults)}
        `
  }

  generateDuplicatesSection(duplicates) {
    if (duplicates.length === 0) return ""

    return `
            <div class="result-section">
                <h2>🔄 Duplicate Cards</h2>
                <div class="duplicate-list">
                    ${duplicates
                      .map(
                        (dup) => `
                        <div class="duplicate-item">
                            Cards #${dup.card1} and #${dup.card2} are identical
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `
  }

  generateErrorsSection(errors) {
    if (errors.length === 0) return ""

    return `
            <div class="result-section">
                <h2>⚠️ Validation Errors</h2>
                <div class="duplicate-list">
                    ${errors
                      .map(
                        (error) => `
                        <div class="duplicate-item">
                            <strong>Card #${error.cardNumber}:</strong> ${error.errors.join(", ")}
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `
  }

  displayComparison(comparison) {
    const resultsContainer = document.getElementById("results")

    resultsContainer.innerHTML = `
            <div class="result-section">
                <h2>⚖️ Dataset Comparison</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${comparison.commonCards}</div>
                        <div class="stat-label">Common Cards</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${comparison.uniqueToDataset1}</div>
                        <div class="stat-label">Unique to Dataset 1</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${comparison.uniqueToDataset2}</div>
                        <div class="stat-label">Unique to Dataset 2</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${comparison.totalUnique}</div>
                        <div class="stat-label">Total Unique Cards</div>
                    </div>
                </div>
                
                <div class="comparison-section">
                    <div class="comparison-card">
                        <div class="comparison-title">📁 Dataset 1 Analysis</div>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-value">${comparison.dataset1.totalCards}</div>
                                <div class="stat-label">Total Cards</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${comparison.dataset1.validCards}</div>
                                <div class="stat-label">Valid Cards</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${comparison.dataset1.duplicateCards.length}</div>
                                <div class="stat-label">Duplicates</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="comparison-card">
                        <div class="comparison-title">📁 Dataset 2 Analysis</div>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-value">${comparison.dataset2.totalCards}</div>
                                <div class="stat-label">Total Cards</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${comparison.dataset2.validCards}</div>
                                <div class="stat-label">Valid Cards</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${comparison.dataset2.duplicateCards.length}</div>
                                <div class="stat-label">Duplicates</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
  }

  displayError(message) {
    const resultsContainer = document.getElementById("results")
    resultsContainer.innerHTML = `
            <div class="result-section">
                <h2>❌ Error</h2>
                <div class="validation-item invalid">
                    <span class="validation-icon">❌</span>
                    <span class="validation-text">${message}</span>
                </div>
            </div>
        `
  }

  clearAll() {
    this.dataset1 = null
    this.dataset2 = null
    this.shuffledDataset = null

    document.getElementById("file1").value = ""
    document.getElementById("file2").value = ""
    document.getElementById("file1-info").textContent = ""
    document.getElementById("file2-info").textContent = ""
    document.getElementById("results").innerHTML = ""

    this.updateButtonStates()
  }

  /**
   * Shuffles card IDs from an original range to a new target range in reverse order.
   * Only cards within the specified original range are included in the output.
   * The length of the original range must match the length of the new target range.
   */
  shuffleCardIds() {
    const originalStartId = Number.parseInt(document.getElementById("originalStartId").value, 10)
    const originalEndId = Number.parseInt(document.getElementById("originalEndId").value, 10)
    const newStartId = Number.parseInt(document.getElementById("newStartId").value, 10)
    const newEndId = Number.parseInt(document.getElementById("newEndId").value, 10)

    // Validate input ranges
    if (
      isNaN(originalStartId) ||
      isNaN(originalEndId) ||
      isNaN(newStartId) ||
      isNaN(newEndId) ||
      originalStartId <= 0 ||
      originalEndId <= 0 ||
      newStartId <= 0 ||
      newEndId <= 0 ||
      originalStartId > originalEndId ||
      newStartId > newEndId
    ) {
      this.displayError(
        "Invalid ID ranges. Please enter positive numbers where Start ID <= End ID for both original and new ranges.",
      )
      return
    }

    if (!this.dataset1) {
      this.displayError("Please load a primary dataset before shuffling.")
      return
    }

    this.showLoading()

    setTimeout(() => {
      try {
        // Filter to only include cards within the specified original range
        const cardsToShuffle = this.dataset1.filter((card) => card.id >= originalStartId && card.id <= originalEndId)

        if (cardsToShuffle.length === 0) {
          this.displayError("No cards found in the specified original ID range within the loaded dataset.")
          return
        }

        const originalRangeLength = originalEndId - originalStartId + 1
        const newRangeLength = newEndId - newStartId + 1

        // Crucial check: Ensure the number of cards in the original range matches the new target range length
        if (originalRangeLength !== newRangeLength) {
          this.displayError(
            `Number of cards in original range (${originalRangeLength}) does not match the length of the new target range (${newRangeLength}). Please adjust ranges for a 1:1 shuffle.`,
          )
          return
        }

        // Sort cardsToShuffle by their original ID to ensure consistent reverse mapping
        cardsToShuffle.sort((a, b) => a.id - b.id)

        const shuffledCards = []
        const remapping = []

        // Apply reverse mapping for IDs within the range
        for (let j = 0; j < cardsToShuffle.length; j++) {
          const card = cardsToShuffle[j]
          const originalId = card.id

          // Calculate the new relative position in reverse order
          const newRelativePos = cardsToShuffle.length - 1 - j

          // Calculate the new ID based on the new target range's start and the new relative position
          const newId = newStartId + newRelativePos

          shuffledCards.push({ id: newId, data: card.data })
          remapping.push({ original: originalId, new: newId })
        }

        // Sort the shuffled cards by their new IDs for consistent display/analysis
        shuffledCards.sort((a, b) => a.id - b.id)

        this.shuffledDataset = shuffledCards
        this.displayShuffleResults(remapping, shuffledCards.length)
      } catch (error) {
        console.error("Shuffle error:", error)
        this.displayError("Card ID shuffling failed. " + error.message)
      } finally {
        this.hideLoading()
      }
    }, 100)
  }

  displayShuffleResults(remapping, totalShuffledCards) {
    const resultsContainer = document.getElementById("results")
    const remappingHtml = remapping.map((m) => `<li>Card ID ${m.original} &rarr; ${m.new}</li>`).join("")

    resultsContainer.innerHTML = `
        <div class="result-section">
            <h2>🔀 Card ID Shuffle Results</h2>
            <p>Successfully remapped ${remapping.length} card IDs within the specified range.</p>
            <p>Total cards in the new shuffled dataset: ${totalShuffledCards}</p>
            <div class="shuffle-remapping">
                <h3>ID Remapping:</h3>
                <ul>${remappingHtml}</ul>
            </div>
            <button id="downloadShuffledJsonBtn" class="btn-primary" style="margin-top: 20px;">
                <span class="btn-icon">⬇️</span> Download Shuffled JSON
            </button>
            <button id="useShuffledDatasetBtn" class="btn-secondary" style="margin-top: 20px; margin-left: 10px;">
                <span class="btn-icon">🔄</span> Use Shuffled for Analysis
            </button>
        </div>
    `
    document.getElementById("downloadShuffledJsonBtn").addEventListener("click", () => this.downloadShuffledJson())
    document.getElementById("useShuffledDatasetBtn").addEventListener("click", () => this.useShuffledDataset())
  }

  downloadShuffledJson() {
    if (!this.shuffledDataset) {
      alert("No shuffled dataset to download.")
      return
    }
    const outputData = {}
    this.shuffledDataset.forEach((card) => {
      outputData[card.id] = card.data // Convert back to the object-based 2D array format
    })
    const jsonString = JSON.stringify(outputData, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "shuffled_cartelas.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  useShuffledDataset() {
    if (this.shuffledDataset) {
      this.dataset1 = this.shuffledDataset // Replace dataset1 with the shuffled one
      document.getElementById("file1-info").innerHTML = `
            <strong>Shuffled Dataset</strong><br>
            ${this.dataset1.length} cards loaded (remapped)
        `
      this.dataset2 = null // Clear dataset2 to avoid confusion
      document.getElementById("file2").value = ""
      document.getElementById("file2-info").textContent = ""
      this.updateButtonStates()
      alert("Shuffled dataset is now set as Primary Dataset for analysis/comparison.")
    } else {
      alert("No shuffled dataset available.")
    }
  }
}

// Initialize the analyzer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new BingoAnalyzer()
})
