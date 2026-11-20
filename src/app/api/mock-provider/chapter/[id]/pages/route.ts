import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    images: [
      "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/1-872d85965e431a92919ed37e3c7fc8def639ee05190c7e05a478692babf38619.jpg",
      "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/2-8cb62ac80990b2d57a16b9988d12aea10559676077b686590543802201abd2bd.jpg",
      "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/3-12777d4c38babade06991c145716ac6eb5192d0ddc23c71cd9247f6caf00407f.jpg",
      "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/4-f87c538da264c92b8d4bbbe924d5e94b28db761595d2cba560091811e582845c.jpg"
    ],
  });
}
