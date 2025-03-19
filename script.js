document.getElementById("meterForm").addEventListener("submit", function (event) {
    event.preventDefault();

    let date = document.getElementById("date").value;
    let units = parseFloat(document.getElementById("units").value);

    if (!date || isNaN(units)) {
        alert("Please enter valid data!");
        return;
    }

    // Store data in Google Sheets
    fetch("https://script.google.com/macros/s/AKfycbxq3LaWVD613pZuuJq8sttdU-HBf1CxLHQwMnwcGoXAnQ2Yu7GTG6j65cIhksS0SC-3mw/exec", {
        method: "POST",
        body: JSON.stringify({ date, units }),
    }).then(response => response.json())
    .then(data => {
        alert("Reading saved successfully!");
        loadHistory();
    });
});

// Fetch and Display Data
function loadHistory() {
    fetch("https://script.google.com/macros/s/AKfycbxq3LaWVD613pZuuJq8sttdU-HBf1CxLHQwMnwcGoXAnQ2Yu7GTG6j65cIhksS0SC-3mw/exec")
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
        });
}

// Bill Estimation Based on Telangana Tariff
function calculateBill(units) {
    let rate = 3.00; // Example rate per unit
    return units * rate;
}

// Update Chart
function updateChart(labels, readings) {
    let ctx = document.getElementById("usageChart").getContext("2d");
    new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Daily Usage (kWh)",
                data: readings,
                borderColor: "#007BFF",
                fill: false
            }]
        }
    });
}

// Load data on page load
loadHistory();

// Meter Reading Scan with OCR
document.getElementById("scanBtn").addEventListener("click", function () {
    let image = document.getElementById("imageUpload").files[0];
    if (!image) {
        alert("Please upload an image of the meter.");
        return;
    }

    let reader = new FileReader();
    reader.onload = function (event) {
        let img = new Image();
        img.src = event.target.result;

        img.onload = function () {
            Tesseract.recognize(img, "eng").then(({ data: { text } }) => {
                let extractedReading = text.match(/\d+/g); // Extract numbers
                if (extractedReading) {
                    document.getElementById("units").value = extractedReading[0]; // Set in input field
                    document.getElementById("scanResult").innerText = "Detected: " + extractedReading[0];
                } else {
                    alert("Could not recognize the reading. Try again.");
                }
            });
        };
    };
    reader.readAsDataURL(image);
});
