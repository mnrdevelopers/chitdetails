const scriptURL = "https://script.google.com/macros/s/AKfycbzVF-vCtUEcc-6nyHFapHlmWSo3UM7vQm1-keDT7bTs/dev";

function saveReading() {
    let uscNumber = document.getElementById("uscNumber").value.trim();
    let date = document.getElementById("date").value;
    let units = parseFloat(document.getElementById("units").value);

    if (!uscNumber || uscNumber.length !== 10 || isNaN(uscNumber) || !date || isNaN(units)) {
        alert("Please enter a valid 10-digit USC Number and meter reading!");
        return;
    }

    fetch(scriptURL, {
        method: "POST",
        body: JSON.stringify({ uscNumber, date, units }),
    }).then(response => response.json())
    .then(data => {
        alert("Reading saved successfully!");
        loadUserHistory(uscNumber);
    });
}

function loadUserHistory(uscNumber) {
    fetch(`${scriptURL}?uscNumber=${encodeURIComponent(uscNumber)}`)
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
        });
}

function calculateBill(units) {
    let rate = 5.50; // ₹ per kWh
    return units * rate;
}

document.getElementById("uscNumber").addEventListener("input", function () {
    let uscNumber = this.value.trim();
    if (uscNumber.length === 10) {
        loadUserHistory(uscNumber);
    }
});
