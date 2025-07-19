class BingoAnalyzer {
  constructor() {
    this.dataset1 = null
    this.dataset2 = null
    this.initializeEventListeners()
  }

  initializeEventListeners() {
    document.getElementById("file1").addEventListener("change", (e) => this.handleFileUpload(e, 1))
    document.getElementById("file2").addEventListener("change", (e) => this.handleFileUpload(e, 2))
    document.getElementById("analyzeBtn").addEventListener("click", () => this.analyzeDataset())
    document.getElementById("compareBtn").addEventListener("click", () => this.compareDatasets())
    document.getElementById("clearBtn").addEventListener("click", () => this.clearAll())
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
      infoElement.innerHTML = `<span style="color: #dc3545;">Error: Invalid JSON file</span>`
      console.error("File parsing error:", error)
    }
  }

  normalizeData(data) {
    // Handle object format: {"1": [[...]], "2": [[...]]}
    if (typeof data === "object" && !Array.isArray(data)) {
      return Object.values(data)
    }
    // Handle array format: [[[...]], [[...]]]
    return data
  }

  updateButtonStates() {
    const analyzeBtn = document.getElementById("analyzeBtn")
    const compareBtn = document.getElementById("compareBtn")

    analyzeBtn.disabled = !this.dataset1
    compareBtn.disabled = !this.dataset1 || !this.dataset2
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

    const cardHashes = new Map()
    const columns = ["B", "I", "N", "G", "O"]
    const ranges = [
      [1, 15],
      [16, 30],
      [31, 45],
      [46, 60],
      [61, 75],
    ]

    dataset.forEach((card, cardIndex) => {
      let isValidCard = true
      const cardErrors = []

      // Structure validation
      if (!Array.isArray(card) || card.length !== 5) {
        isValidCard = false
        cardErrors.push("Invalid card structure")
        analysis.structureValidation.invalid++
      } else {
        let validRows = 0
        card.forEach((row, rowIndex) => {
          if (Array.isArray(row) && row.length === 5) {
            validRows++
          }
        })

        if (validRows === 5) {
          analysis.structureValidation.valid++
        } else {
          isValidCard = false
          cardErrors.push("Invalid row structure")
          analysis.structureValidation.invalid++
        }
      }

      if (Array.isArray(card) && card.length === 5) {
        // Free space validation (center should be -1 or "FREE")
        const centerValue = card[2][2]
        if (centerValue === -1 || centerValue === "FREE") {
          analysis.freeSpaceValidation.correct++
        } else {
          analysis.freeSpaceValidation.incorrect++
          cardErrors.push("Invalid free space")
          isValidCard = false
        }

        // Number range and distribution validation
        let rangeValid = true
        const cardNumbers = new Set()

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
                cardErrors.push(`Number ${value} out of range for column ${column}`)
              }
            }
          })
        })

        if (rangeValid) {
          analysis.rangeValidation.valid++
        } else {
          analysis.rangeValidation.invalid++
          isValidCard = false
        }

        // Duplicate card detection
        const cardHash = this.generateCardHash(card)
        if (cardHashes.has(cardHash)) {
          analysis.duplicateCards.push({
            card1: cardHashes.get(cardHash),
            card2: cardIndex + 1,
            hash: cardHash,
          })
          isValidCard = false
        } else {
          cardHashes.set(cardHash, cardIndex + 1)
        }
      }

      if (isValidCard) {
        analysis.validCards++
      } else {
        analysis.invalidCards++
        analysis.validationResults.push({
          cardNumber: cardIndex + 1,
          errors: cardErrors,
        })
      }
    })

    return analysis
  }

  generateCardHash(card) {
    return JSON.stringify(card.map((row) => row.map((val) => (val === -1 || val === "FREE" ? "FREE" : val))))
  }

  performComparison(dataset1, dataset2) {
    const analysis1 = this.performAnalysis(dataset1)
    const analysis2 = this.performAnalysis(dataset2)

    // Find common cards
    const hashes1 = new Set()
    const hashes2 = new Set()

    dataset1.forEach((card) => hashes1.add(this.generateCardHash(card)))
    dataset2.forEach((card) => hashes2.add(this.generateCardHash(card)))

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

    document.getElementById("file1").value = ""
    document.getElementById("file2").value = ""
    document.getElementById("file1-info").textContent = ""
    document.getElementById("file2-info").textContent = ""
    document.getElementById("results").innerHTML = ""

    this.updateButtonStates()
  }
}

// Initialize the analyzer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new BingoAnalyzer()
})
