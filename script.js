let xmlFiles = {};  // Store XML files by name
let xmlTags = new Set();  // tags under <gl-cor:entryDetail>
let selfClosingDetails = {};  // self-closing tag details by filename

// zip upload
function handleUpload() {
    const fileInput = document.getElementById('zipUpload').files[0];
    const progressFill = document.getElementById('progressFill');
    const tagProgressFill = document.getElementById('tagProgressFill');

    if (!fileInput) {
        alert("ZIP dosyası seçmeniz gerekmekte.");
        return;
    }

    const zip = new JSZip();
    progressFill.style.width = '0%';  
    tagProgressFill.style.width = '0%'; 

    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 80) {  // simulating uploading progress
            progress += 20;
            progressFill.style.width = `${progress}%`;
        }
    }, 500);

    zip.loadAsync(fileInput).then((contents) => {
        let totalFiles = Object.keys(contents.files).length;
        let processedFiles = 0;

        for (let filename in contents.files) {
            if (filename.endsWith(".xml")) {
                zip.file(filename).async("string").then((data) => {
                    parseXML(data, filename);

                    // Update file processing progress
                    processedFiles++;
                    let progressPercent = Math.floor((processedFiles / totalFiles) * 100);
                    progressFill.style.width = `${progressPercent}%`;
                });
            }
        }
        clearInterval(progressInterval);
        progressFill.style.width = '100%'; 
    }).catch(() => {
        clearInterval(progressInterval);
        alert("ZIP dosyası okunurken hata alındı.");
    });
}

// tag names under <gl-cor:entryDetail>
function parseXML(xmlContent, filename) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    // Add to xmlFiles for later search
    xmlFiles[filename] = xmlDoc;

    const entryDetails = xmlDoc.getElementsByTagName("gl-cor:entryDetail");

    let totalTags = entryDetails.length;
    let parsedTags = 0;

    for (let i = 0; i < entryDetails.length; i++) {
        const childNodes = entryDetails[i].getElementsByTagName("*");
        for (let j = 0; j < childNodes.length; j++) {
            xmlTags.add(childNodes[j].tagName);
            parsedTags++;

            let tagProgressPercent = Math.floor((parsedTags / totalTags) * 100);
            document.getElementById('tagProgressFill').style.width = `${tagProgressPercent}%`;
        }
    }

    updateTagSelect();
}

// update dropdown with available tags under <gl-cor:entryDetail>
function updateTagSelect() {
    const tagSelect = document.getElementById('tagSelect');
    tagSelect.innerHTML = '<option value="">örn: documentNumber</option>';  // Reset the dropdown

    xmlTags.forEach((tag) => {
        const option = document.createElement('option');
        option.value = tag;
        option.text = tag;
        tagSelect.appendChild(option);  // Add each unique tag as an option
    });

    // Mark tag parsing as complete
    document.getElementById('tagProgressFill').style.width = '100%';
}

// Perform search based on selected tag
function performSearch() {
    const selectedTag = document.getElementById('tagSelect').value;
    const resultDiv = document.getElementById('results');
    resultDiv.innerHTML = '';  // Clear previous results

    if (!selectedTag) {
        alert("Hata alınan / aranacak tag seçiniz.");
        return;
    }

    selfClosingDetails = {};  // Reset self-closing tag details

    let results = [];
    for (const [filename, xmlDoc] of Object.entries(xmlFiles)) {
        // Get <gl-cor:entryDetail> elements
        const entryDetails = xmlDoc.getElementsByTagName("gl-cor:entryDetail");

        let countFilledTags = 0;
        let countSelfClosingTags = 0;

        // Loop through each <gl-cor:entryDetail> and find the selected tag
        for (let i = 0; i < entryDetails.length; i++) {
            const nodes = entryDetails[i].getElementsByTagName(selectedTag);
            for (let j = 0; j < nodes.length; j++) {
                // Check if the tag is self-closing (no content) or filled
                if (nodes[j].textContent.trim()) {
                    countFilledTags++;
                } else {
                    countSelfClosingTags++;
                    // Store details of this entry for later viewing
                    if (!selfClosingDetails[filename]) {
                        selfClosingDetails[filename] = [];
                    }
                    selfClosingDetails[filename].push(entryDetails[i]);
                }
            }
        }

        if (countFilledTags + countSelfClosingTags > 0) {
            let result = `<strong>${filename}:</strong> ${countFilledTags} verisi dolu alan bulundu, ` +
                         `${countSelfClosingTags} boş alan bulundu.`;

            if (countSelfClosingTags > 0) {
                // Add a "Detayları göster" button if there are self-closing tags
                result += ` <button onclick="showDetails('${filename}')">Detayları göster</button>`;
            }
            results.push(result);
        }
    }

    // Display results
    if (results.length > 0) {
        results.forEach((result) => {
            const p = document.createElement('p');
            p.innerHTML = result;
            resultDiv.appendChild(p);
        });
    } else {
        resultDiv.innerHTML = "<p>İlgili tag arama gerçekleştirilen XML dosyasında bulunamadı.</p>";
    }
}

// Show details for self-closing tags in a document
function showDetails(filename) {
    const resultDiv = document.getElementById('results');
    resultDiv.innerHTML += `<h3>${filename} Detaylar:</h3>`;

    // Display a table with line numbers and a button to show details
    const table = document.createElement('table');
    table.className = 'details-table';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Add header row
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<th>Yevmiye Madde No</th><th> </th>`;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Add rows for each entry with self-closing tags
    Object.keys(selfClosingDetails).forEach(filename => {
        selfClosingDetails[filename].forEach(detail => {
            const lineNumber = getTagContent(detail, 'gl-cor:lineNumber');
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${lineNumber}</td><td><button onclick="toggleDetail('${filename}', '${lineNumber}')">Detay</button></td>`;
            tbody.appendChild(tr);
        });
    });

    table.appendChild(tbody);
    resultDiv.appendChild(table);
}

// Show/hide details for a specific line number
function toggleDetail(filename, lineNumber) {
    const detailsDivId = `detail-div-${filename}-${lineNumber}`;
    let detailDiv = document.getElementById(detailsDivId);

    if (!detailDiv) {
        // Create the detail div if it doesn't exist
        const entryDetails = selfClosingDetails[filename].filter(detail =>
            getTagContent(detail, 'gl-cor:lineNumber') === lineNumber
        );

        if (entryDetails.length > 0) {
            detailDiv = document.createElement('div');
            detailDiv.id = detailsDivId;
            detailDiv.className = 'detail-div';
            
            // Add details to the div
            detailDiv.innerHTML = entryDetails.map(detail => {
                return formatEntryDetail(detail);
            }).join('<hr>'); // Add a separator between entries
            
            // Find the table row for the given line number
            const table = document.querySelector('.details-table');
            const rows = table.getElementsByTagName('tr');
            let targetRow;

            for (let row of rows) {
                const lineNumberCell = row.cells[0];
                if (lineNumberCell && lineNumberCell.textContent.trim() === lineNumber) {
                    targetRow = row;
                    break;
                }
            }

            if (targetRow) {
                // Insert the detail div after the target row
                targetRow.insertAdjacentElement('afterend', detailDiv);
            }
        }
    }

    // Toggle the visibility of the detail div
    detailDiv.style.display = (detailDiv.style.display === 'none' || !detailDiv.style.display) ? 'block' : 'none';
}


// Format XML details for display
function formatEntryDetail(detail) {
    const accountMainID = getTagContent(detail, 'gl-cor:accountMainID');
    const accountMainDescription = getTagContent(detail, 'gl-cor:accountMainDescription');
    const accountSubID = getTagContent(detail, 'gl-cor:accountSubID');
    const postingDate = getTagContent(detail, 'gl-cor:postingDate');
    const documentDate = getTagContent(detail, 'gl-cor:documentDate');
    const documentTypeDescription = getTagContent(detail, 'gl-cor:documentTypeDescription');

  //currency not used yet
    const totalDebit = getTagContent(detail, 'gl-bus:totalDebit');
    const totalCredit = getTagContent(detail, 'gl-bus:totalCredit');
    const currency = getCurrency(detail);

    return `
        <p>Ana Hesap: ${accountMainID}</p>
        <p>Ana Hesap Tanımı: ${accountMainDescription}</p>
        <p>Alt Ana Hesap: ${accountSubID}</p>
        <p>Kayıt Tarihi: ${postingDate}</p>
        <p>Belge Tarihi: ${documentDate}</p>
        <p>Doküman Tipi: ${documentTypeDescription}</p>
    `;
}

// Extract content from the tag
function getTagContent(detail, tagName) {
    const tag = detail.getElementsByTagName(tagName)[0];
    return tag ? tag.textContent.trim() : 'N/A';
}

// not used yet --05.09.24
function getCurrency(detail) {
    const totalDebit = detail.getElementsByTagName('gl-bus:totalDebit')[0];
    if (totalDebit) return totalDebit.getAttribute('unitRef');
    const totalCredit = detail.getElementsByTagName('gl-bus:totalCredit')[0];
    return totalCredit ? totalCredit.getAttribute('unitRef') : 'N/A';
}
