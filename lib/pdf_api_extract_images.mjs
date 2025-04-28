import 'dotenv/config';
import {createRequire} from "module";
const require = createRequire(import.meta.url);
const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFParams,
  ExtractElementType,
  ExtractPDFJob,
  ExtractPDFResult,
  ExtractRenditionsElementType
} = require("@adobe/pdfservices-node-sdk");
const fs = require("fs");
const path = require("path");
var shortid = require('shortid');


export async function extract_imagefiles(file_to_process) {
  let zipfile_path;
  let zipfile_name;
  await (async (pdf_file = file_to_process) => {
    
    zipfile_path = path.dirname(pdf_file) + "/" + shortid.generate();
    zipfile_name = zipfile_path + ".zip";
    
    let readStream;
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
      const params = new ExtractPDFParams({
        elementsToExtract: [ExtractElementType.TEXT, ExtractElementType.TABLES],
        elementsToExtractRenditions: [ExtractRenditionsElementType.FIGURES, ExtractRenditionsElementType.TABLES]
      });

      // Creates a new job instance
      const job = new ExtractPDFJob({ inputAsset, params });

      // Submit the job and get the job result
      const pollingURL = await pdfServices.submit({ job });
      const pdfServicesResponse = await pdfServices.getJobResult({
        pollingURL,
        resultType: ExtractPDFResult
      });

      // Get content from the resulting asset(s)
      const resultAsset =  pdfServicesResponse.result.resource;
      const streamAsset = await pdfServices.getContent({ asset: resultAsset });
      
      // Creates a write stream and copy stream asset's content to it
      const outputFilePath = zipfile_name;
      
      const writeStream = fs.createWriteStream(outputFilePath);
      streamAsset.readStream.pipe(writeStream);
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
      console.log("write finished");

    } catch (err) {
      console.log("Exception encountered while executing operation", err);
    } finally {
      readStream?.destroy();
    }
    
  })();
  return zipfile_path;
}


