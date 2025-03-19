document.getElementById("meterForm").addEventListener("submit", function (event) {
    event.preventDefault();

    let uscNumber = document.getElementById("uscNumber").value.trim();
    let date = document.getElementById("date").value;
    let units = parseFloat(document.getElementById("units").value);

    // Validate USC Number (8 digits)
    if (!uscNumber || uscNumber.length !== 8 || isNaN(uscNumber) || !date || isNaN(units)) {
        alert("Please enter a valid 8-digit USC Number and meter reading!");
        return;
    }

    // Send data to Google Sheets
    fetch("https://script.google.com/macros/s/AKfycbzVF-vCtUEcc-6nyHFapHlmWSo3UM7vQm1-keDT7bTs/dev", {
        method: "POST",
        body: JSON.stringify({ uscNumber, date, units }),
    })
    .then(response => response.json())
    .then(data => {
        alert("Reading saved successfully!");
        loadUserHistory(uscNumber);
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Failed to save reading. Please try again.");
    });
});

// Fetch user-specific history
function loadUserHistory(uscNumber) {
    fetch(`https://script.google.com/macros/s/AKfycbzVF-vCtUEcc-6nyHFapHlmWSo3UM7vQm1-keDT7bTs/dev?uscNumber=${encodeURIComponent(uscNumber)}`)
        .then(response => response.json())
        .then(data => {
            let table = document.getElementById("historyTable");
            table.innerHTML = "";

            let labels = [];
            let readings = [];

            data.forEach((entry, index) => {
                let prevUnits = index > 0 ? data[index - 1].units : entry.units;
                let unitsUsed = entry.units - prevUnits;
                let billAmount = calculateBill(unitsUsed);

                let row = `<tr>
                    <td>${entry.date}</td>
                    <td>${entry.units}</td>
                    <td>${unitsUsed}</td>
                    <td>₹${billAmount.toFixed(2)}</td>
                </tr>`;
                table.innerHTML += row;

                labels.push(entry.date);
                readings.push(unitsUsed);
            });

            updateChart(labels, readings);
        })
        .catch(error => {
            console.error("Error:", error);
            alert("Failed to load history. Please try again.");
        });
}

// Load history when USC is entered
document.getElementById("uscNumber").addEventListener("input", function () {
    let uscNumber = this.value.trim();
    if (uscNumber.length === 8) { // Check for 8 digits
        loadUserHistory(uscNumber);
    }
});

// Calculate the bill based on units used
function calculateBill(unitsUsed) {
    // Define your billing logic here
    // Example: ₹5 per unit
    const ratePerUnit = 5;
    return unitsUsed * ratePerUnit;
}

// Update the Chart.js chart
function updateChart(labels, readings) {
    let ctx = document.getElementById('usageChart').getContext('2d');
    if (window.myChart) {
        window.myChart.destroy();
    }
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Units Used',
                data: readings,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Handle image upload and scanning
document.getElementById("scanBtn").addEventListener("click", function () {
    let file = document.getElementById("imageUpload").files[0];
    if (file) {
        Tesseract.recognize(file, 'eng')
            .then(result => {
                document.getElementById("scanResult").innerText = "Scanned Reading: " + result.text;
                document.getElementById("units").value = parseFloat(result.text);
            })
            .catch(error => {
                console.error("Error scanning image:", error);
                alert("Failed to scan image. Please try again.");
            });
    } else {
        alert("Please upload an image first.");
    }
});
