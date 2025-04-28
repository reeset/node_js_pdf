import 'dotenv/config';
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const fs = require('fs').promises;
const fs_1 = require('fs');
const path = require('path');


async function resizeImage(original_image, modified_image, width, height) {
    try {
      await sharp(original_image)
        .resize(width, height)
        .toFormat("png")
        .toFile(modified_image);
      console.log('Image has been resized correctly: ' + original_image);
    } catch (error) {
      console.error('Error resizing image: ' + original_image, error);
    }
  }

export async function getAltText(imagePath,
    prompt,
    model_id) {

    // Configure the client
    const client = new BedrockRuntimeClient({
        region: process.env.AWS_REGION, // or your desired region
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            // optional: sessionToken if you're using temporary credentials
        }
    });

    //we need to check the file-size.  the api seems to have a fairly small limit.  If 
    //a file is larger than  3800000 bytes -- we resize the file to 800 x 800

    const stat = fs_1.statSync(imagePath);
    

    // Read image file into a buffer
    const imageBuffer = fs_1.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mime = "image/png";

    if (String(imagePath).toLowerCase().endsWith("png")==false ||
        stat.size > 3800000) {
        await resizeImage(imagePath, imagePath + ".png", 600,600);
        imagePath = imagePath + ".png";
    }

    const payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime,
                            "data": imageBase64
                        }
                    }
                ]
            }
        ],
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 10000
    };

    const command = new InvokeModelCommand({
        modelId: model_id,
        contentType: "application/json",
        body: JSON.stringify(payload)
    });


    const response = await client.send(command);

    try {
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        // Extract the generated text
        const json_output = responseBody.content[0].text;
        const generated_metadata = JSON.parse(json_output);
        const altText = generated_metadata.image.alt;
        return altText;
    } catch {
        //there are things the ai generator will refuse to attempt to describe.  This shows up 
        //as an invalid json.  Return an error message.
        return "An image description was unable to be generated.";
    }
}

//let t = await getAltText("C:\\Users\\reese\\Downloads\\output\\QJjY7PwPT\\figures\\fileoutpart0.png");
//console.log(t);
