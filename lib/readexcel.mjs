import 'dotenv/config';
import {createRequire} from "module";
const require = createRequire(import.meta.url);

//I need to find a different library -- this on 
//has a vulnerability but was easy to initially work with

const xlsx = require('xlsx');
const path = require('path');



export async function GetImageIds(excel_filepath) {
    // Load the Excel file    
    const workbook = xlsx.readFile(excel_filepath);

    // List all sheet names
    var sheet_index = -1;
    const sheetNames = workbook.SheetNames;
    for (var i = 0; i < sheetNames.length; i++) {
        if (sheetNames[i].toLowerCase() == 'figures') {
            sheet_index = i;
            break;
        }
    }

    // Read the first sheet
    const firstSheetName = sheetNames[sheet_index];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert sheet to JSON
    const data = xlsx.utils.sheet_to_json(worksheet);

    //print out just the objectids for the autotagged data
    //console.log('Sheet Data:', data);

    // Extract __EMPTY_3 values
    let started = false;
    let val_reset = false;
    var autoTaggedIds = [];

    for (const item of data) {
        if (item.__EMPTY === 'AI auto-tagged PDF') {
            val_reset = true;
            autoTaggedIds = [];
            continue; // skip this marker row
        }

        if (item.__EMPTY_3 === 'Object Id') {
            started = true;
            continue;
        }

        if ((started === true || val_reset === true) 
            && '__EMPTY_3' in item) {  
            if (item.__EMPTY_3 != null) {
                autoTaggedIds.push(item.__EMPTY_3);
            }
          }
    }    
    //console.log(autoTaggedIds);  // Output: [32, 26]
    return autoTaggedIds;
}