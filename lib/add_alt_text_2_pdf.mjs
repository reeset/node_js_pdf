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
const fs = require('fs').promises;
const fs_1 = require('fs');


export async function ModifyPDF(pdfPath, pdfSave, local_image_dict) {
    try {

        //console.log("printing the map: " + image_dict);
        const pdfData = await fs_1.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfData);

        const linkProcessingPromises = [];
        pdfDoc.context.enumerateIndirectObjects().forEach(([pdfRef, pdfObject]) => {
            if (pdfObject instanceof PDFDict) {
                const type = pdfObject.lookup(PDFName.of('Type'))?.encodedName;
                const structType = pdfObject.lookup(PDFName.of('S'))?.encodedName;

                if (structType === "/Figure") {                    
                    const objId = pdfRef.objectNumber;
                    const altText = pdfObject.lookup(PDFName.of('Alt'))?.value;

                    if (!altText) {
                        if (local_image_dict.has(objId)) {
                            const newAltText = local_image_dict.get(objId);                            
                            pdfObject.set(PDFName.of('Alt'), PDFString.of(newAltText));
                            pdfObject.set(PDFName.of('Contents'), PDFString.of(newAltText));                            
                        } else {
                            console.log("unable to find: " + objId + " in map");
                        }
                    } else {
                        console.log(`Figure found with Object ID: ${objId}, Alt text already exists: ${altText}`);
                    }
                }
            }
        });


        fs.writeFile(pdfSave, await pdfDoc.save());
        console.log("PDF modification complete. Output saved to: " + pdfSave);
    } catch (err) {
        console.error("Error processing PDF:", err);
    }
}