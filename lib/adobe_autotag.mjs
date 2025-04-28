import 'dotenv/config';

import { createRequire } from "module";
const require = createRequire(import.meta.url);


const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  AutotagPDFParams,
  AutotagPDFJob,
  AutotagPDFResult,
  StreamAsset,
} = require("@adobe/pdfservices-node-sdk");
const fs = require("fs");
const path = require("path");
var shortid = require('shortid');

async function pipeAndWaitStreamAsset(outputFilePath, streamAsset) {
  return new Promise((resolve, reject) => {    
    const writeStream = fs.createWriteStream(outputFilePath);

    // Listen for finish on the writable stream
    writeStream.on('finish', () => {
      console.log('Piping complete!');
      resolve(); // Resolve once the writing is done
    });

    // Handle any errors
    writeStream.on('error', (err) => {
      console.error('Write error:', err);
      reject(err); // Reject if there's an error
    });

    // Pipe the data
    streamAsset.readStream.pipe(writeStream);
  });
}
async function pipeAndWaitStreamAssetReport(outputFilePath, streamAssetReport) {
  return new Promise((resolve, reject) => {    
    const writeStream = fs.createWriteStream(outputFilePath);

    // Listen for finish on the writable stream
    writeStream.on('finish', () => {
      console.log('Piping complete!');
      resolve(); // Resolve once the writing is done
    });

    // Handle any errors
    writeStream.on('error', (err) => {
      console.error('Write error:', err);
      reject(err); // Reject if there's an error
    });

    // Pipe the data
    streamAssetReport.readStream.pipe(writeStream);
  });
}
export async function AutoTagIt(file_to_process, output_dir) {
  let excel_path; 
  let auto_tagged_file;
  await (async (pdf_file = file_to_process, tmp_output_dir = output_dir) => {
    let readStream;
    let unique_id = shortid.generate();
    tmp_output_dir = tmp_output_dir + "/" + unique_id;

    console.log("tmpdir to be created: " + tmp_output_dir);
    //make sure the save folder is present
    if (!fs.existsSync(tmp_output_dir)) {
      fs.mkdirSync(tmp_output_dir);
      console.log("Save folder: " + tmp_output_dir + " was created");
    } else {
      console.log("Save folder: " + tmp_output_dir + " exists.  Next step.");
    }
    excel_path = tmp_output_dir + "/" + unique_id + ".xlsx";
    auto_tagged_file = tmp_output_dir + "/" + unique_id + ".pdf";
    try {
      // Initial setup, create credentials instance
      const credentials = new ServicePrincipalCredentials({
        clientId: process.env.PDF_SERVICES_CLIENT_ID,
        clientSecret: process.env.PDF_SERVICES_CLIENT_SECRET
      });

      // Creates a PDF Services instance
      const pdfServices = new PDFServices({ credentials });

      // Creates an asset(s) from source file(s) and upload
      readStream = fs.createReadStream(pdf_file);
      const inputAsset = await pdfServices.upload({
        readStream,
        mimeType: MimeType.PDF
      });

      // Create parameters for the job
      const params = new AutotagPDFParams({
        generateReport: true,
        shiftHeadings: true
      });

      // Creates a new job instance
      const job = new AutotagPDFJob({ inputAsset, params });

      // Submit the job and get the job result
      const pollingURL = await pdfServices.submit({ job });
      const pdfServicesResponse = await pdfServices.getJobResult({
        pollingURL,
        resultType: AutotagPDFResult
      });

      // Get content from the resulting asset(s)
      const resultAsset = pdfServicesResponse.result.taggedPDF;
      const resultAssetReport = pdfServicesResponse.result.report;
      const streamAsset = await pdfServices.getContent({ asset: resultAsset });
      const streamAssetReport = await pdfServices.getContent({ asset: resultAssetReport });

      // Creates an output stream and copy stream asset's content to it
      const outputFilePath = auto_tagged_file;
      const outputFilePathReport = excel_path;
      console.log(`Saving asset at ${outputFilePath}`);
      console.log(`Saving asset at ${outputFilePathReport}`);

      //let writeStream = fs.createWriteStream(outputFilePath);
      //streamAsset.readStream.pipe(writeStream);
      //writeStream = fs.createWriteStream(outputFilePathReport);
      //streamAssetReport.readStream.pipe(writeStream);
      await pipeAndWaitStreamAsset(outputFilePath, streamAsset);
      await pipeAndWaitStreamAssetReport(outputFilePathReport, streamAssetReport);
    } catch (err) {
      console.log("Exception encountered while executing operation", err);
    } finally {
      readStream?.destroy();
    }
  })();
  return [auto_tagged_file, excel_path];
}