//Imports don't seem to work as well -- set up the
//script so we can use require -- that way 
//overlapping dependencies are pushed out
import { createRequire } from "module";
const require = createRequire(import.meta.url);


//Import the env variables.
require('dotenv').config();

//Import PDF-lib
const pdfLib = require('pdf-lib');
const { PDFDocument, PDFName, PDFDict, PDFString } = require('pdf-lib');


//import components
import { AutoTagIt } from "./lib/adobe_autotag.mjs";
import { GetImageIds } from "./lib/readexcel.mjs";
import { extract_imagefiles } from "./lib/pdf_api_extract_images.mjs";
import { getAltText } from "./lib/generate_alt_text.mjs";
import { ModifyPDF } from "./lib/add_alt_text_2_pdf.mjs";

const fs = require('fs').promises;
const fs_1 = require('fs');
const stream = require('stream');
const sharp = require('sharp');
const path = require('path');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const AdmZip = require("adm-zip");

var AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
var AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
var AWS_REGION = process.env.AWS_REGION;
var full_file_list = [];

console.info = function() {};   // Disable console.info

//use with the following structure:
//for await (const p of readDir('/your_path/'))
//   console.log(p)
function getFilesFromFolderSync(folderPath) {
  try {
    const files = fs_1.readdirSync(folderPath);
    for (let x = 0; x < files.length; x++) {
      files[x] = folderPath + "/" + files[x];
    }
    const sortedFiles = files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return sortedFiles;
  } catch (err) {
    console.log('Error reading directory:', err);
  }
}

function getModelId(l_model) {
  switch (l_model) {
    case "default":
    case "sonnet3.51":
      return 'anthropic.claude-3-5-sonnet-20240620-v1:0';
      break;
    case "sonnet3.52":
      return 'anthropic.claude-3-5-sonnet-20241022-v2:0';
      break;
    case "sonnet3.571":
      return 'anthropic.claude-3-7-sonnet-20250219-v1:0';
      break;
    case "novapro":
      return 'amazon.nova-pro-v1:0';
      break;
    default:
      return 'anthropic.claude-3-5-sonnet-20240620-v1:0';
      break;
  }
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function getRandomItems(arr, n) {
  if (n > arr.length) {
    return arr;
  }

  const shuffled = arr.slice(); // clone array
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // swap
  }

  return shuffled.slice(0, n);
}

function generateAltText(objId) {

  //try {
  //  const json_file = await fs.readFile('C:\\Users\\reese\\Downloads\\output\\ExtractTextTableInfoWithFiguresTablesRenditionsFromPDF/extract2024-07-30T14-39-57/structuredData.json', 'utf8');
  //  const data = JSON.parse(json_file);

  // Check if the object ID exists in the JSON
  //if (altTexts[objId]) {
  return 'Generated alt-text: ' + String(objId);
  //} else {
  //  return `Generated alt text for object ${objId}`;
  //}
  //} catch (err) {
  //  console.error("Error reading JSON file:", err);
  //  return `Generated alt text for object ${objId}`;
  //}
}

async function SubMain() {
  /* First thing that we do is parse the 
   * command line -- remember to drop the first two items
   */

  var save_folder_name = '';
  var folder_name = '';
  var model_id = getModelId('default');
  var prompt_file_name = 'prompt.txt';
  var b_random = false;
  var b_random_num = 50;
  var tmp_folder = "";
  var prompt = "";

  /* Usage:
     node pdf_helper.js -s [save_file] -f [folder_to_process] -p [prompt_file] -llm [model_enum] -r
     Values:
        -s = save file
        -f = folder to process (looking at pdfs)
        -p = prompt file [optional]
        -llm = llm enum. [optional] 
          Accepted values: 
            default
            sonnet3.51
            sonnet3.52
            sonnet3.71
            novapro
        -r = random number to process [optional]
  */

  const args = process.argv.slice(2);

  console.log("arg length: " + args.length);
  if (args.length > 0) {
    for (var i = 0; i < args.length; i++) {
      if (args[i] == '-s') {
        save_folder_name = args[i + 1];
        i++;
      } else if (args[i] == '-f') {
        folder_name = args[i + 1];
        i++;
      } else if (args[i] == '-p') {
        prompt_file_name = args[i + 1];
        i++;
      } else if (args[i] == '-llm') {
        l_model = getModelId(args[i + 1]);
        i++;
      } else if (args[i] == '-r') {
        b_random = true;
        b_random_num = Number(args[i + 1]);
        i++;
      }
    }
  } else {
    //if debugging -- use the example directory for testing
    save_folder_name = "./pdf_output/";
    folder_name = "./example";
  }

  tmp_folder = "./tmp_outputs";

  //make sure the save folder is present
  if (!fs_1.existsSync(save_folder_name)) {
    fs_1.mkdirSync(save_folder_name);
    console.log("Save folder: " + save_folder_name + " was created");
  } else {
    console.log("Save folder: " + save_folder_name + " exists.  Next step.");
  }

  if (!fs_1.existsSync(tmp_folder)) {
    fs_1.mkdirSync(tmp_folder);
  } else {
    //delete the folder and recreate it
    fs_1.rmdirSync(tmp_folder, {recursive: true, force: true});
    fs_1.mkdirSync(tmp_folder);
  }

  //Get our file list
  console.log("reading folder: " + folder_name);
  full_file_list = getFilesFromFolderSync(folder_name);

  var random_full_file_list = full_file_list;
  if (b_random == true) {
    random_full_file_list = getRandomItems(full_file_list, b_random_num);
  }

  //get our prompt
  prompt = fs_1.readFileSync(prompt_file_name, 'utf8');

  let pdf_count = 1;

  for (let x = 0; x < random_full_file_list.length; x++) {
    let file2process = random_full_file_list[x];
    console.log("is this a file: " + file2process);
    console.log('Processing pdf file ' + pdf_count);

    //Step 1 -- autotag the data

    let [tmp_autotagged_file, tmp_excel_file] = await AutoTagIt(file2process, tmp_folder);

    
    //sleep(1500);
    console.log("autotagged file: " + tmp_autotagged_file);
    console.log("excel file: " + tmp_excel_file);

    //we now have the excel file and the autotagged file.
    //read the excel file and get ids
    const image_objects = await GetImageIds(tmp_excel_file);
    console.log("Image objects found: " + image_objects);

    //Now -- extract images
    let tmp_zipped_filepath = await extract_imagefiles(tmp_autotagged_file);
    console.log("Return File: " + tmp_zipped_filepath);
    
    //unzip file
    let zip = new AdmZip(tmp_zipped_filepath + ".zip");
    zip.extractAllTo(tmp_zipped_filepath);
    console.log("File has been unzipped");

    //enumerate through the files and attach the object id with the image

    let image_files = getFilesFromFolderSync(tmp_zipped_filepath + "/figures");
    let image_dict  = new Map(); //this will be a dict where object id is the identifer and alt text is the value

    for(let y = 0; y < image_files.length; y++) {
      let alttext = await getAltText(image_files[y], prompt, model_id);
      //console.log("id: " + image_objects[y] + " :: " + image_files[y])
      image_dict.set(image_objects[y], alttext);
    }

    console.log(image_dict);

    //finish updating the pdf
    await ModifyPDF(tmp_autotagged_file, 
      save_folder_name + "/" + path.basename(file2process), 
      image_dict)

  }

};

await SubMain();
console.log("finished");

