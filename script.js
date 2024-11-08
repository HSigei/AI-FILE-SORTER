let currentData = null;
let headers = null;
let lastSortedColumn = null;
let lastSortDirection = null;

document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('columnSelect').addEventListener('change', analyzeColumnData);


function showStatusMessage(message) {
    const statusDiv = document.getElementById('statusMessage') || (() => {
        const div = document.createElement('div');
        div.id = 'statusMessage';
        div.style.padding = '10px';
        div.style.marginBottom = '10px';
        div.style.backgroundColor = '#80ef80';
        div.style.color = 'black';
        div.style.borderRadius = '4px';
        div.style.display = 'none';
        document.getElementById('dataTable').parentNode.insertBefore(div, document.getElementById('dataTable'));
        return div;
    })();
    
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
   
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 10000);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('fileName').textContent = file.name;
    showStatusMessage(`Loading file: ${file.name}`);
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileExtension === 'csv') {
        Papa.parse(file, {
            complete: function(results) {
                processData(results.data);
                showStatusMessage(`Successfully loaded CSV file: ${file.name}`);
            },
            header: true
        });
    } else if (['xlsx', 'xls'].includes(fileExtension)) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            processData(jsonData);
            showStatusMessage(`Successfully loaded Excel file: ${file.name}`);
        };
        reader.readAsArrayBuffer(file);
    }
}

function processData(data) {
    if (data.length < 2) return;
    
    if (Array.isArray(data[0])) {
        headers = data[0];
        currentData = data.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        });
    } else {
        headers = Object.keys(data[0]);
        currentData = data;
    }

    populateColumnSelect();
    enableButtons();
    displayData();
    document.getElementById('sortControls').classList.remove('hidden');
}

function populateColumnSelect() {
    const select = document.getElementById('columnSelect');
    select.innerHTML = '<option value="">Select column to sort by...</option>';
    
    headers.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        select.appendChild(option);
    });
}

function analyzeColumnData() {
    const selectedColumn = document.getElementById('columnSelect').value;
    if (!selectedColumn) return;

    const sampleValues = currentData
        .map(row => row[selectedColumn])
        .filter(val => val !== null && val !== undefined && val !== '')
        .slice(0, 5);

    let inferredType = 'text';
    
    if (sampleValues.every(val => !isNaN(parseFloat(val)))) {
        inferredType = 'number';
    }
    else if (sampleValues.every(val => !isNaN(Date.parse(val)))) {
        inferredType = 'date';
    }

    document.getElementById('dataTypeSelect').value = inferredType;
    showStatusMessage(`Column "${selectedColumn}" detected as ${inferredType} type`);
}

function sortData(direction) {
    const selectedColumn = document.getElementById('columnSelect').value;
    if (!selectedColumn) {
        alert('Please select a column to sort by');
        return;
    }

    const dataType = document.getElementById('dataTypeSelect').value;

    currentData.sort((a, b) => {
        let valueA = a[selectedColumn];
        let valueB = b[selectedColumn];

        if (valueA === null || valueA === undefined || valueA === '') return 1;
        if (valueB === null || valueB === undefined || valueB === '') return -1;

        switch (dataType) {
            case 'number':
                valueA = parseFloat(valueA);
                valueB = parseFloat(valueB);
                break;
            case 'date':
                valueA = new Date(valueA);
                valueB = new Date(valueB);
                break;
            default:
                valueA = valueA.toString().toLowerCase();
                valueB = valueB.toString().toLowerCase();
        }

        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    lastSortedColumn = selectedColumn;
    lastSortDirection = direction;
    displayData();
    showStatusMessage(`Data sorted ${direction === 'asc' ? 'ascending' : 'descending'} by "${selectedColumn}"`);
}

function enableButtons() {
    document.getElementById('removeDuplicatesBtn').disabled = false;
    document.getElementById('removeEmptyBtn').disabled = false;
    document.getElementById('downloadBtn').disabled = false;
    document.getElementById('sortAscBtn').disabled = false;
    document.getElementById('sortDescBtn').disabled = false;
}

function displayData() {
    const table = document.getElementById('dataTable');
    table.innerHTML = '';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        if (header === lastSortedColumn) {
            th.classList.add(lastSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    currentData.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header] || '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

function removeDuplicates() {
    const initialCount = currentData.length;
    const seen = new Set();
    currentData = currentData.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    displayData();
    const removedCount = initialCount - currentData.length;
    showStatusMessage(`Removed ${removedCount} duplicate row${removedCount !== 1 ? 's' : ''}`);
}

function removeEmptyRows() {
    const initialCount = currentData.length;
    currentData = currentData.filter(row => {
        return Object.values(row).some(value => 
            value !== null && value !== undefined && value.toString().trim() !== ''
        );
    });
    displayData();
    const removedCount = initialCount - currentData.length;
    showStatusMessage(`Removed ${removedCount} empty row${removedCount !== 1 ? 's' : ''}`);
}

function downloadFile() {
    const worksheet = XLSX.utils.json_to_sheet(currentData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Processed Data");
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `processed_data_${timestamp}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
    showStatusMessage(`File downloaded as "${filename}"`);
}