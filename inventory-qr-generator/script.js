document.addEventListener('DOMContentLoaded', () => {
    const sheetUrlInput = document.getElementById('sheet-url');
    const loadBtn = document.getElementById('load-btn');
    const printBtn = document.getElementById('print-btn');
    const searchInput = document.getElementById('search-input');
    const refreshBtn = document.getElementById('refresh-btn');
    const labelsContainer = document.getElementById('labels-container');
    const printContainer = document.getElementById('print-container');
    const itemCountBadge = document.getElementById('item-count');
    const tagSizeSelect = document.getElementById('tag-size');
    const gridColsInput = document.getElementById('grid-cols');
    const qrColorInput = document.getElementById('qr-color');
    const manualDataTextarea = document.getElementById('manual-data');
    const generateManualBtn = document.getElementById('generate-manual-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    let inventoryData = [];
    let filteredData = [];

    // Shared Load Function
    async function loadDataFromUrl() {
        const url = sheetUrlInput.value.trim();
        if (!url) {
            alert('Por favor ingresa una URL válida.');
            return;
        }

        loadBtn.disabled = true;
        refreshBtn.disabled = true;
        loadBtn.textContent = 'Cargando...';
        refreshBtn.classList.add('spinning');

        try {
            // First attempt: Direct fetch
            let response;
            try {
                response = await fetch(url);
            } catch (e) {
                console.warn("Direct fetch failed, trying proxy...", e);
                // Second attempt: CORS Proxy
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                response = await fetch(proxyUrl);
            }

            if (!response.ok) throw new Error('No se pudo acceder a la URL.');

            const csvText = await response.text();
            parseCSV(csvText);

            filteredData = [...inventoryData];
            generateLabels();

            printBtn.disabled = false;
            searchInput.disabled = false;
            refreshBtn.disabled = false;
        } catch (error) {
            console.error(error);
            alert('Error al cargar datos: ' + error.message);
        } finally {
            loadBtn.disabled = false;
            refreshBtn.disabled = false;
            loadBtn.textContent = 'Cargar Datos';
            refreshBtn.classList.remove('spinning');
        }
    }

    // Tab Switching Logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-panel`).classList.add('active');
        });
    });

    // Load data from Google Sheets (CSV)
    loadBtn.addEventListener('click', loadDataFromUrl);
    refreshBtn.addEventListener('click', loadDataFromUrl);

    // Handle Manual Generation
    generateManualBtn.addEventListener('click', () => {
        const text = manualDataTextarea.value.trim();
        if (!text) {
            alert('Pega algunos datos primero.');
            return;
        }

        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        inventoryData = lines.map(line => line.split('\t').map(c => c.trim())); // Split by tab if from Excel

        filteredData = [...inventoryData];
        generateLabels();

        printBtn.disabled = false;
        searchInput.disabled = false;
    });

    // Handle Search/Filtering
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();

        if (!query) {
            filteredData = [...inventoryData];
        } else {
            filteredData = inventoryData.filter(row => {
                // Search in all columns of the row
                return row.some(cell => cell.toString().toLowerCase().includes(query));
            });
        }

        generateLabels();
    });

    function parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        inventoryData = lines.map(line => {
            return line.split(',').map(item => item.trim());
        });

        // Optional: remove header if it contains common header terms
        if (inventoryData.length > 0) {
            const firstLineCells = inventoryData[0].map(c => c.toLowerCase());
            const headerKeywords = ['id', 'código', 'codigo', 'número', 'numero', 'nombre', 'descrip'];
            if (headerKeywords.some(keyword => firstLineCells.includes(keyword))) {
                inventoryData.shift();
            }
        }
    }

    function generateLabels() {
        labelsContainer.innerHTML = '';
        printContainer.innerHTML = '';

        if (filteredData.length === 0) {
            labelsContainer.innerHTML = '<div class="empty-state"><p>' +
                (inventoryData.length > 0 ? 'No se encontraron resultados.' : 'Carga o pega datos para comenzar.') +
                '</p></div>';
            itemCountBadge.textContent = '0 items';
            return;
        }

        itemCountBadge.textContent = `${filteredData.length} items`;

        const cols = gridColsInput.value || 4;
        labelsContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

        const printGrid = document.createElement('div');
        printGrid.className = 'print-grid';
        printGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        printContainer.appendChild(printGrid);

        const sizeMap = {
            'small': 100,
            'medium': 160,
            'large': 240
        };
        const qrSize = sizeMap[tagSizeSelect.value];
        const qrColor = qrColorInput.value;

        filteredData.forEach((row, index) => {
            const value = row[0]; // Assuming first column is the ID/Number
            if (!value) return;

            // Preview Item
            const labelItem = document.createElement('div');
            labelItem.className = 'label-item';

            const qrDiv = document.createElement('div');
            qrDiv.id = `qr-preview-${index}`;
            qrDiv.className = 'qr-img';
            labelItem.appendChild(qrDiv);

            const textSpan = document.createElement('div');
            textSpan.className = 'label-text';
            textSpan.textContent = value;
            labelItem.appendChild(textSpan);

            labelsContainer.appendChild(labelItem);

            // Print Item
            const printItem = document.createElement('div');
            printItem.className = 'label-print';

            const qrPrintDiv = document.createElement('div');
            qrPrintDiv.id = `qr-print-${index}`;
            printItem.appendChild(qrPrintDiv);

            const printText = document.createElement('p');
            printText.textContent = value;
            printItem.appendChild(printText);

            printGrid.appendChild(printItem);

            // Generate QRs
            new QRCode(qrDiv, { text: value, width: qrSize, height: qrSize, colorDark: qrColor });

            new QRCode(qrPrintDiv, { text: value, width: qrSize, height: qrSize, colorDark: qrColor });
        });
    }

    printBtn.addEventListener('click', () => {
        window.print();
    });

    [tagSizeSelect, gridColsInput, qrColorInput].forEach(el => {
        el.addEventListener('change', () => {
            if (filteredData.length > 0) {
                generateLabels();
            }
        });
    });
});
