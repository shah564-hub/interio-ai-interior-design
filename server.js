
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";
import { Client, handle_file } from "@gradio/client";

const app = express();
const PORT = 3001;

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://interio-ai-interior-design.vercel.app",
    "https://interio-ai-interior-design-4gmmqm7w6-shah-685d.vercel.app"
  ]
}));
app.use(express.json({ limit: "20kb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Please upload a JPG, PNG, or WebP image."));
    }
  },
});

let gradioClientPromise;

function getGradioClient() {
  if (!gradioClientPromise) {
    if (!process.env.HF_TOKEN) {
      throw new Error("Hugging Face token is missing. Check your .env file.");
    }

    gradioClientPromise = Client.connect(
      "black-forest-labs/FLUX.2-klein-4B",
      {
        hf_token: process.env.HF_TOKEN,
      }
    );
  }

  return gradioClientPromise;
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Interio AI backend",
    provider: "Hugging Face FLUX.2 Klein",
  });
});

app.post("/api/redesign", upload.single("roomImage"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a room image.",
      });
    }

    const { room, style, budget, instructions } = req.body;

    if (!room || !style || !budget) {
      return res.status(400).json({
        error: "Room type, design style, and budget are required.",
      });
    }

    const roomDetails = {
      bedroom: "a bedroom with a comfortable bed",
      living: "a living room with a sofa and seating area",
      workspace: "a functional home office with a desk and office chair",
      kitchen: "a practical kitchen with cabinets and countertops",
      dining: "a dining room with a dining table and chairs",
    };

    const roomDescription =
      roomDetails[room.toLowerCase()] || `a ${room}`;

    const styleGuides = {
      Japandi:
        "Japandi interior design, Japanese minimalism blended with Scandinavian warmth, natural oak wood, soft beige, warm neutral colours, organic textures, uncluttered styling",
      Scandinavian:
        "Scandinavian interior design, bright airy atmosphere, pale wood, soft neutral colours, cosy textiles, simple functional furniture",
      "Modern Minimal":
        "modern minimalist interior design, clean geometric forms, uncluttered spaces, refined neutral palette, elegant functional furniture",
      Contemporary:
        "contemporary interior design, sophisticated modern furniture, balanced textures, tasteful accents, refined materials",
    };

    const budgetGuides = {
      "₹50k – ₹1L":
        "budget-conscious furniture and decor, affordable materials, simple practical improvements",
      "₹1L – ₹3L":
        "mid-range quality furniture, coordinated materials, thoughtfully selected lighting and decor",
      "₹3L+":
        "premium furniture, luxurious materials, sophisticated lighting, high-end finishes and refined detailing",
    };

    const styleDescription =
      styleGuides[style] || `${style} interior design`;

    const budgetDescription =
      budgetGuides[budget] || `design suitable for ${budget}`;

    const prompt = `
Redesign the uploaded photograph into a photorealistic interior design project.

IMPORTANT: The room must remain ${roomDescription}.
Do not change it into another type of room.

Preserve the original room's:
- Architecture and structural layout
- Wall positions and ceiling
- Windows and doors in their original positions
- Camera viewpoint and perspective
- Overall room dimensions

DESIGN STYLE:
${styleDescription}

BUDGET:
${budgetDescription}

FURNITURE REQUIREMENTS:
Use furniture appropriate for ${roomDescription}.
Do not add furniture belonging to another room type.

DESIGN QUALITY:
Create a beautiful, professionally designed, realistic interior.
Use cohesive materials, appropriate furniture proportions,
natural lighting, realistic shadows, and elegant decor.

${instructions ? `ADDITIONAL USER INSTRUCTIONS: ${instructions}` : ""}

The result must look like a real photograph of the same room
after a professional interior renovation.
Do not create a collage, illustration, floor plan, or 3D diagram.
`;

    // Read original dimensions and preserve aspect ratio.
    const metadata = await sharp(req.file.buffer).metadata();

    const originalWidth = metadata.width || 1024;
    const originalHeight = metadata.height || 1024;

    const scale = 1024 / Math.max(originalWidth, originalHeight);

    const width = Math.max(
      256,
      Math.round((originalWidth * scale) / 8) * 8
    );

    const height = Math.max(
      256,
      Math.round((originalHeight * scale) / 8) * 8
    );

    console.log("Connecting to Hugging Face FLUX.2 Klein...");

    const client = await getGradioClient();

    console.log("Sending room image for redesign...");

    const result = await client.predict("/infer", {
      prompt,
      input_images: [
        {
          image: handle_file(req.file.buffer),
        },
      ],
      mode_choice: "Distilled (4 steps)",
      seed: 0,
      randomize_seed: true,
      width,
      height,
      num_inference_steps: 4,
      guidance_scale: 1,
      prompt_upsampling: false,
    });

    const generatedImage = result.data?.[0];
    const seed = result.data?.[1];

    if (!generatedImage) {
      throw new Error("The AI provider did not return an image.");
    }

    let imageBuffer;

    if (generatedImage.url) {
      const imageResponse = await fetch(generatedImage.url);

      if (!imageResponse.ok) {
        throw new Error("Could not retrieve the generated image.");
      }

      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    } else if (generatedImage.path) {
      throw new Error(
        "The AI returned a local image path instead of a public image URL."
      );
    } else {
      throw new Error("The AI returned an unsupported image format.");
    }

    const mimeType = generatedImage.mime_type || "image/png";

    console.log("Room redesign completed.");

    return res.json({
      image: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
      seed,
      room,
      style,
    });
  } catch (error) {
    console.error("Redesign error:", error);

    return res.status(500).json({
      error:
        error.message ||
        "Room redesign failed. Please try again later.",
    });
  }
});

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(error.status || 500).json({
    error: error.message || "Something went wrong.",
  });
});

app.listen(PORT, () => {
  console.log(`Interio backend running at http://localhost:${PORT}`);
});
