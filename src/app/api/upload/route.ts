import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cloudinary } from "@/lib/cloudinary";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/withRateLimit";

async function postHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);
  if (session.user.role !== "DISTRIBUTOR") return errorResponse("UNAUTHORIZED", "Only distributors can upload images", 403);

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return errorResponse("INVALID_INPUT", "No file provided", 400);
  }

  if (!file.type.startsWith("image/")) {
    return errorResponse("INVALID_INPUT", "File must be an image", 400);
  }

  if (file.size > 5 * 1024 * 1024) {
    return errorResponse("INVALID_INPUT", "Image must be under 5MB", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const uploadPromise = new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "products", transformation: [{ width: 800, crop: "limit" }] }, (err, res) => {
        if (err || !res) return reject(err ?? new Error("Upload failed"));
        resolve(res);
      })
      .end(buffer);
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Cloudinary upload timed out after 15s")), 15_000)
  );

  const result = await Promise.race([uploadPromise, timeoutPromise]);

  return NextResponse.json({ url: result.secure_url });
}

export const POST = withRateLimit("DISTRIBUTOR", postHandler as Parameters<typeof withRateLimit>[1]);
