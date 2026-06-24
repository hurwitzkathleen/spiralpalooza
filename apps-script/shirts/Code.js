function doPost(e) {
  try {
    var data;

    // Handle both JSON body and form POST with payload field
    if (e.postData && e.postData.type === "application/json") {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.payload) {
      data = JSON.parse(e.parameter.payload);
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Shirt Orders")
               || ss.insertSheet("Shirt Orders");

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp", "Name", "Email",
        "Adult XS","Adult Small","Adult Medium",
        "Adult Large","Adult XL","Adult 2XL","Adult 3XL",
        "Femme XS","Femme Small","Femme Medium",
        "Femme Large","Femme XL","Femme 2XL",
        "Youth 2T","Youth 3T","Youth 4T",
        "Youth Small (6-8)","Youth Medium (10-12)",
        "Youth Large (14-16)","Youth XL",
        "Notes"
      ]);
      sheet.getRange(1, 1, 1, 24).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    var sizes = [
      "Adult XS","Adult Small","Adult Medium",
      "Adult Large","Adult XL","Adult 2XL","Adult 3XL",
      "Femme XS","Femme Small","Femme Medium",
      "Femme Large","Femme XL","Femme 2XL",
      "Youth 2T","Youth 3T","Youth 4T",
      "Youth Small (6-8)","Youth Medium (10-12)",
      "Youth Large (14-16)","Youth XL"
    ];

    var row = [
      new Date(),
      data.name  || "",
      data.email || ""
    ];

    sizes.forEach(function(size) {
      row.push((data.sizes && data.sizes[size]) ? data.sizes[size] : 0);
    });

    row.push(data.notes || "");
    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({status:"success"}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({status:"error", message:err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}