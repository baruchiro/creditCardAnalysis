/*==================================
This script analyzes Israeli credit cards 
and builds a db people can build nice dashboards from.
Instructions for a new Sheet:
- make sure the sheet has the following tabs:
--DB
--Status
--Categories
--_categories_flattened (this is a utility tab to hold temporary calculations)

DB headers. Rows for all headers but last (category) are created by this script.
-Date Added
-Card Type
-Card Number
-Billing Month
-Transaction Date
-Business Name
-Amount
-Currency
-Category
-- this column is created automatically by using the following formula:
"=arrayformula(iferror(vlookup(F2:F,'_categories_flattened'!A2:B,2,FALSE),"ללא סיווג"))"

Status headers. rows for all headers are created by this script.
-File Name
-File ID

Categories tab 
- This tab is handled manually (you can choose your own categories and where each business goes)
- The only mandatory column is the last one which is "ללא סיווג". Its first row should run the following formula:
"=QUERY(DB!F2:I,"select F where I='ללא סיווג'",0)"

_categories_flattened tab
This tab organizes the categories table from previous tab in a list.
Headers:
- Business name
-- "=filter(flatten(Categories!A2:O),NOT(ISBLANK(flatten(Categories!A2:O))))"
- Category
-- "=arrayformula(reverseLookup(A2:A,transpose(Categories!A:O)))"
*/

//==================================
//Get GDrive folder ID from folder name 
function get_folder_id(monitoredFolder){
  var folders = DriveApp.getFoldersByName(monitoredFolder);
  var folderID = null;
  if (folders.hasNext()){
    folderID = folders.next().getId();
  }
  return folderID;
}

//==================================
//Get the list of files from a folder
function get_file_list(folderID){
  var folderHandle = DriveApp.getFolderById(folderID);
  return folderHandle.getFiles();
}

//==================================
//Create an arbitrary struct (for building the rows in the db)
function makeStruct(names) {
  var names = names.split(', ');
  var count = names.length;
  function constructor() {
    for (var i = 0; i < count; i++) {
      this[names[i]] = arguments[i];
    }
  }
  return constructor;
}

//==================================
// Detect credit card type by file name
function get_credit_card_type(fid){
  var file = DriveApp.getFileById(fid);
  var filename = file.getName();
  
  if(filename.startsWith('Export')){
    return 'Isracard';
  }
  else if(filename.startsWith('Transactions')){
          return 'Visa';
          }
  else if(filename.startsWith('transaction')){
    return 'Max';
  }
  else{
    return 'Unknown';
  }
}

//==================================
// Parse MAX credit card files (begins with "transaction")
function get_max_data(f_handler, categoriesTable){
  sheets = f_handler.getSheets();
  var item = new makeStruct("inputDate, type, nCard, billingMonth, transactionDate, name, amount, currency");
  var out_data = [];
  var nCard = '';
  var billingMonth = new Date(0);
  var inputDate = new Date();
  
  for (var s = 0; s < sheets.length; s++){
    lastRow = sheets[s].getLastRow();
    lastCol = sheets[s].getLastColumn();
    var data = sheets[s].getRange(1,1,lastRow,lastCol).getValues();

        
    for (var r=0; r < lastRow; r++){
      var row = data[r];
 
      if (row[0].split('/').length == 2){
        billingMonth.setYear(row[0].split('/')[1]);
        billingMonth.setMonth(row[0].split('/')[0]);
        billingMonth.setMonth(billingMonth.getMonth()-1); // because JS Date months are zero-based
        continue;
      }
      else if (row[0].split('-').length == 3){
        var formattedRow = new item();
        formattedRow.inputDate = inputDate;
        formattedRow.type = 'Max';
        formattedRow.nCard = row[3];
        formattedRow.billingMonth = billingMonth;
        formattedRow.transactionDate = new Date(row[0].split('-')[2], row[0].split('-')[1], row[0].split('-')[0]);

        formattedRow.name = row[1];
        formattedRow.amount = row[5]
        formattedRow.currency = row[6]
                
        out_data.push(formattedRow);
        continue;
      }
      else{ continue;}
      }
    }
  return {'data': out_data, 'nRow': out_data.length, 'nCol': Object.keys(out_data[0]).length};
 }

//==================================
// Parse Isracard credit card files (begins with "export")
function get_isracard_data(f_handler, categoriesTable){
  sheet = f_handler.getSheets()[0];
  lastRow = sheet.getLastRow();
  lastCol = sheet.getLastColumn();
  var data = sheet.getRange(1,1,lastRow,lastCol).getValues();
  var item = new makeStruct("inputDate, type, nCard, billingMonth, transactionDate, name, amount, currency");
  var out_data = [];
  var nCard = '';
  var billingMonth = new Date(0); 
  var inputDate = new Date();
  var abroadCharges = 0; 
  
  for (var r=0; r < lastRow; r++){
    var row = data[r];
    
    if (row[1] == 'מועד חיוב'){
      nCard = row[0].split(' - ')[row[0].split(' - ').length -1];
      billingMonth.setYear(['20', row[2].split('/')[2]].join(''));
      billingMonth.setMonth(row[2].split('/')[1]);
      billingMonth.setMonth(billingMonth.getMonth()-1); // because JS Date months are zero-based
      continue;
    }
    else if (row[0] == 'עסקאות בארץ'){
      abroadCharges = 0;
      continue;
    }
    else if (row[0] == 'עסקאות בחו˝ל'){
      abroadCharges = 1;
      continue;
    }
    else if (row[0].split('/').length == 3){
      var formattedRow = new item();
      formattedRow.inputDate = inputDate;
      formattedRow.type = 'Isracard';
      formattedRow.nCard = nCard;
      formattedRow.billingMonth = billingMonth;
      
      formattedRow.transactionDate = new Date(row[0].split('/')[2],row[0].split('/')[1],row[0].split('/')[0]);
      
      if (abroadCharges == 1){
        formattedRow.name = row[2];
        formattedRow.amount = row[5];
        formattedRow.currency = row[6];
      }
      else{
        formattedRow.name = row[1];
        formattedRow.amount = row[4];
        formattedRow.currency = row[5];
        }
      
      if(formattedRow.name == 'TOTAL FOR DATE'){ continue;}
      
      out_data.push(formattedRow);
      
      continue;
      
    }  
    else{ continue;}
  }
  return {'data': out_data, 'nRow': out_data.length, 'nCol': Object.keys(out_data[0]).length};
 }

//==================================
// Parse Visa credit card files (begins with "Transactions")
function get_visa_data(f_handler, categoriesTable){
  sheets = f_handler.getSheets();
  var item = new makeStruct("inputDate, type, nCard, billingMonth, transactionDate, name, amount, currency");
  var out_data = [];
  var nCard = '';
  var billingMonth = new Date(0);
  var inputDate = new Date();
  
  for (var s = 0; s < sheets.length; s++){
    lastRow = sheets[s].getLastRow();
    lastCol = sheets[s].getLastColumn();
    var data = sheets[s].getRange(1,1,lastRow,lastCol).getValues();

        
    for (var r=0; r < lastRow; r++){
      var row = data[r];
 
      if (Object.prototype.toString.call(row[0]) == "[object String]"){
        if (row[0].startsWith('פירוט עסקות לכרטיס')){
          var nCardRe = new RegExp(/(\d{3,4})/);
          nCard = nCardRe.exec(row[0])[0];
        }
        continue;
      }
      else if (Object.prototype.toString.call(row[0]) == "[object Date]"){

        var formattedRow = new item();
        formattedRow.inputDate = inputDate;
        formattedRow.type = 'Visa';
        formattedRow.nCard = nCard;
        
        billingMonth.setYear(row[0].getFullYear());
        billingMonth.setMonth(row[0].getMonth());
        
        formattedRow.billingMonth = billingMonth.toLocaleDateString("en-US");
        formattedRow.transactionDate = row[0].toLocaleDateString("en-US");

        formattedRow.name = row[1];
        formattedRow.amount = row[3]
        formattedRow.currency = '₪';
                
        out_data.push(formattedRow);
        continue;
      }
      else{ continue;}
      }
    }
  return {'data': out_data, 'nRow': out_data.length, 'nCol': Object.keys(out_data[0]).length};
 }

//==================================
function update_status_sheet(files, sheet){
  for (m = 0; m < files.length; m++){
    fileId = files[m];
    fileName = SpreadsheetApp.openById(fileId).getName();
    sheet.appendRow([fileName, fileId]);
  }
  return;  
}

//==================================
function get_row_values(sheet, rowNum){
  return sheet.getRange([rowNum, rowNum].join(':')).getValues()[0];
}

//==================================
function get_column_letter_from_name(row, name){
  return String.fromCharCode(65 + row.indexOf(name));
}
  
//==================================
function get_new_files_by_list(folderID, statusSheet){

  var FilesIdColumnLetter = get_column_letter_from_name(get_row_values(statusSheet,1), 'File ID');
  var listOfProcessesFiles = statusSheet.getRange([FilesIdColumnLetter, FilesIdColumnLetter].join(':')).getValues();
  var folderFileList = get_file_list(folderID);
  var listOfProcessesFiles1d = listOfProcessesFiles.map(x => x[0]);
  var newFilesArray = [];
  while(folderFileList.hasNext()){
    var fileID = folderFileList.next().getId();
    var exist = listOfProcessesFiles1d.indexOf(fileID);
    if (exist > -1){
      continue;
    }
    else{
      newFilesArray.push(fileID);
    }
  }
  return newFilesArray;
}


//==================================
function main(howManyDaysBack = 60){
  var monitoredFolder = 'Credit Card Bills';
  var analysisFileID = '1kNx9pUtVgyKJWAZR_CvdSz9_3aDrdgxwFzrRwB5EsSQ';
  var analysisFile = SpreadsheetApp.openById(analysisFileID);
  var analysisDbSheet = analysisFile.getSheetByName('DB');
  var analysisStatusSheet = analysisFile.getSheetByName('Status');
  var analysisCategoriesSheet = analysisFile.getSheetByName('Categories');
  
  var monitoredFolderID = get_folder_id(monitoredFolder);
  var newFiles = get_new_files_by_list(monitoredFolderID, analysisStatusSheet);
  var categoriesTable = analysisCategoriesSheet.getDataRange().getValues();
  
  for (var i=0; i<newFiles.length; i++){
    fid = newFiles[i];
    
    var fileType = get_credit_card_type(fid);
    src_fh = SpreadsheetApp.openById(fid);
    
    switch(fileType){
      case "Max":
        out = get_max_data(src_fh, categoriesTable);
        break;
      case 'Isracard':
        out = get_isracard_data(src_fh, categoriesTable);
        break;
      case 'Visa':
        out = get_visa_data(src_fh, categoriesTable);
      default:
        data = 0
        break;
    }
    var data = [];
    for (j=0; j< out['nRow']; j++){
      data[j] = []
      for (var key in out['data'][j]){
        data[j].push(out['data'][j][key]);
      }
    }
    for (k=0; k< out['nRow']; k++){
      analysisDbSheet.appendRow(data[k]);
    }
  }
  update_status_sheet(newFiles, analysisStatusSheet);
  
  Logger.log('done!');
}

//==================================
function triggered_1day_back(){
  main(1);
}

//==================================
function update_category(){
  var analysisFileID = '1kNx9pUtVgyKJWAZR_CvdSz9_3aDrdgxwFzrRwB5EsSQ';
  var analysisFile = SpreadsheetApp.openById(analysisFileID);
  var analysisDbSheet = analysisFile.getSheetByName('DB');
  var analysisCategoriesSheet = analysisFile.getSheetByName('Categories');
  var categoriesTable = analysisCategoriesSheet.getDataRange().getValues();
  
  var lastRow = analysisDbSheet.getLastRow();
  var lastCol = analysisDbSheet.getLastColumn();
  
  
  var data = analysisDbSheet.getRange(1,1,lastRow,lastCol).getValues();
  
  var categoryCol = data[0].indexOf('Category')+1;
  var nameCol = data[0].indexOf('Business Name')+1;
  
  for (var r=2; r < lastRow; r++){
    
    var name = analysisDbSheet.getRange(r, nameCol).getValue();
    var category = get_category(name, categoriesTable);
    
    analysisDbSheet.getRange(r, categoryCol).setValue(category);
  }
    
}

//==================================
function onOpen() {
  var spreadsheet = SpreadsheetApp.getActive();
  var menuItems = [
    {name: 'Check For New Files', functionName: 'main'},
    {name: 'Refresh Categories', functionName: 'update_category'}
  ];
  spreadsheet.addMenu('Credit Cards Analysis', menuItems);
}

//==================================
/**
 * For a value in a table, teturn the column header where the value is found.
 *
 * @param {value} value.
 * @param {in_range} range to look.
 * @return The index.
 * @customfunction
 */
function REVERSELOOKUP(input, in_range){
  
  function map_value(value, range){
    return value.length > 0 ?
      range.filter(row => row.indexOf(value) > -1)[0][0] : 
      "";
  }
    
  return Array.isArray(input) ?
      input.map(cell => map_value(cell[0], in_range)) :
      map_value(input, in_range);
}
