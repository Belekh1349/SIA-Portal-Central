// 1. Abre tu Google Sheet de destino.
// 2. Ve a 'Extensiones' > 'Apps Script'.
// 3. Borra todo el código anterior y pega este código con SISTEMA DE LOGS:

function doGet(e) {
    var sheet = getDatabaseSheet();
    var data = sheet.getDataRange().getValues();
    var result = {
        records: {},
        profile: {}
    };

    for (var i = 1; i < data.length; i++) {
        var type = data[i][0];
        var key = data[i][1];
        var value = data[i][2];

        if (type === 'RECORD') {
            try {
                result.records[key] = JSON.parse(value);
            } catch (e) {
                result.records[key] = value;
            }
        } else if (type === 'PROFILE') {
            result.profile[key] = value;
        }
    }

    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    var logSheet = getLogSheet();
    logSheet.appendRow([new Date(), "Petición recibida", "Procesando..."]);

    var contents = e.postData ? e.postData.contents : null;
    var content;

    try {
        content = JSON.parse(contents);
    } catch (err) {
        // Si no es JSON puro, intentamos leer de los parámetros
        content = e.parameter;
        logSheet.appendRow([new Date(), "Aviso", "Datos recibidos por parámetros o error en JSON"]);
    }

    var sheet = getDatabaseSheet();

    if (content && (content.action === 'SYNC_ALL' || content['action'] === 'SYNC_ALL')) {
        logSheet.appendRow([new Date(), "Acción", "SYNC_ALL detectado"]);

        sheet.clear();
        var rows = [['TYPE', 'KEY', 'VALUE', 'TIMESTAMP']];
        var now = new Date();

        // Procesar profile
        var profile = content.profile || (content['profile'] ? JSON.parse(content['profile']) : null);
        if (profile) {
            for (var k in profile) {
                if (k !== 'sheetsUrl') {
                    rows.push(['PROFILE', k, profile[k], now]);
                }
            }
        }

        // Procesar records
        var records = content.records || (content['records'] ? JSON.parse(content['records']) : null);
        if (records) {
            for (var date in records) {
                rows.push(['RECORD', date, JSON.stringify(records[date]), now]);
            }
            logSheet.appendRow([new Date(), "Éxito", "Registros guardados: " + Object.keys(records).length]);
        }

        if (rows.length > 1) {
            sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
        }

        return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: rows.length - 1 }))
            .setMimeType(ContentService.MimeType.JSON);
    } else {
        logSheet.appendRow([new Date(), "Error", "No se detectó la acción SYNC_ALL o el contenido está vacío"]);
    }
}

function getDatabaseSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Database');
    if (!sheet) {
        sheet = ss.insertSheet('Database');
        sheet.appendRow(['TYPE', 'KEY', 'VALUE', 'TIMESTAMP']);
    }
    return sheet;
}

function getLogSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Logs');
    if (!sheet) {
        sheet = ss.insertSheet('Logs');
        sheet.appendRow(['Fecha', 'Evento', 'Detalle']);
    }
    return sheet;
}

// PASOS CRÍTICOS PARA LA IMPLEMENTACIÓN:
// 1. Haz clic en 'Implementar' > 'Gestionar implementaciones'.
// 2. Haz clic en el ícono del LÁPIZ para editar.
// 3. En la lista de 'Versión', selecciona 'NUEVA VERSIÓN'.
// 4. Haz clic en 'Implementar'.
// 5. Copia la URL que termina en /exec.
// 6. Ve a tu App de Actividades > Admin Mode > Pega la URL > Botón Sincronizar.
