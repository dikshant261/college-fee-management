using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

namespace CollegeFeeManagement
{
    public class IconBuilder
    {
        public static int Main(string[] args)
        {
            try
            {
                string inputPng = args.Length > 0 ? args[0] : @"assets\clg-icon.png";
                string outputIco = args.Length > 1 ? args[1] : @"assets\app.ico";

                if (!File.Exists(inputPng))
                {
                    Console.Error.WriteLine("Error: Source PNG file not found: " + inputPng);
                    return 1;
                }

                Console.WriteLine("Converting " + inputPng + " to " + outputIco + "...");

                using (Bitmap srcBitmap = new Bitmap(inputPng))
                {
                    // Standard Windows Icon Resolutions
                    int[] sizes = new int[] { 16, 24, 32, 48, 64, 128, 256 };
                    List<byte[]> imageBuffers = new List<byte[]>();

                    foreach (int size in sizes)
                    {
                        using (Bitmap resized = new Bitmap(size, size, PixelFormat.Format32bppArgb))
                        {
                            using (Graphics g = Graphics.FromImage(resized))
                            {
                                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                                g.SmoothingMode = SmoothingMode.HighQuality;
                                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                                g.CompositingQuality = CompositingQuality.HighQuality;
                                g.Clear(Color.Transparent);
                                g.DrawImage(srcBitmap, 0, 0, size, size);
                            }

                            if (size == 256)
                            {
                                // Vista / Win 7 / Win 8 / Win 10 / Win 11 standard 256x256 PNG frame
                                using (MemoryStream ms = new MemoryStream())
                                {
                                    resized.Save(ms, ImageFormat.Png);
                                    imageBuffers.Add(ms.ToArray());
                                }
                            }
                            else
                            {
                                // Sizes <= 128: Standard Windows DIB (Device Independent Bitmap) + 1bpp AND mask
                                using (MemoryStream ms = new MemoryStream())
                                {
                                    BinaryWriter bw = new BinaryWriter(ms);

                                    int maskRowBytes = ((size + 31) / 32) * 4;
                                    int maskSize = maskRowBytes * size;
                                    int pixelDataSize = size * size * 4;

                                    // BITMAPINFOHEADER (40 bytes)
                                    bw.Write((uint)40);              // biSize
                                    bw.Write(size);                  // biWidth
                                    bw.Write(size * 2);              // biHeight (XOR image + AND mask combined)
                                    bw.Write((ushort)1);             // biPlanes
                                    bw.Write((ushort)32);            // biBitCount
                                    bw.Write((uint)0);               // biCompression = BI_RGB
                                    bw.Write((uint)(pixelDataSize + maskSize)); // biSizeImage
                                    bw.Write(0);                     // biXPelsPerMeter
                                    bw.Write(0);                     // biYPelsPerMeter
                                    bw.Write((uint)0);               // biClrUsed
                                    bw.Write((uint)0);               // biClrImportant

                                    // Pixel data (stored bottom-to-top in DIB)
                                    BitmapData bd = resized.LockBits(
                                        new Rectangle(0, 0, size, size),
                                        ImageLockMode.ReadOnly,
                                        PixelFormat.Format32bppArgb
                                    );

                                    byte[] rawPixels = new byte[pixelDataSize];
                                    for (int y = size - 1; y >= 0; y--)
                                    {
                                        IntPtr rowPtr = new IntPtr(bd.Scan0.ToInt64() + (long)y * bd.Stride);
                                        Marshal.Copy(rowPtr, rawPixels, (size - 1 - y) * size * 4, size * 4);
                                    }
                                    resized.UnlockBits(bd);
                                    bw.Write(rawPixels);

                                    // AND Mask (1 bit per pixel, bottom-to-top, padded to 32-bit boundary)
                                    // With 32-bit alpha channel, all zeros means opaque/transparency handled by alpha
                                    byte[] mask = new byte[maskSize];
                                    bw.Write(mask);

                                    imageBuffers.Add(ms.ToArray());
                                }
                            }
                        }
                    }

                    // Ensure target directory exists
                    string outDir = Path.GetDirectoryName(outputIco);
                    if (!string.IsNullOrEmpty(outDir) && !Directory.Exists(outDir))
                    {
                        Directory.CreateDirectory(outDir);
                    }

                    // Write ICO binary format
                    using (FileStream fs = new FileStream(outputIco, FileMode.Create, FileAccess.Write))
                    {
                        BinaryWriter bw = new BinaryWriter(fs);

                        // ICONDIR Header (6 bytes)
                        bw.Write((ushort)0);             // Reserved, must be 0
                        bw.Write((ushort)1);             // Resource Type: 1 = ICO
                        bw.Write((ushort)sizes.Length);  // Number of images

                        // ICONDIRENTRY list (16 bytes per image)
                        int offset = 6 + (16 * sizes.Length);
                        for (int i = 0; i < sizes.Length; i++)
                        {
                            int size = sizes[i];
                            bw.Write((byte)(size == 256 ? 0 : size)); // Width (0 means 256)
                            bw.Write((byte)(size == 256 ? 0 : size)); // Height (0 means 256)
                            bw.Write((byte)0);                        // Color count (0 for 32bpp)
                            bw.Write((byte)0);                        // Reserved
                            bw.Write((ushort)1);                      // Color planes
                            bw.Write((ushort)32);                     // Bits per pixel
                            bw.Write((uint)imageBuffers[i].Length);   // Data length
                            bw.Write((uint)offset);                   // Offset in file
                            offset += imageBuffers[i].Length;
                        }

                        // Write Image Buffers
                        for (int i = 0; i < sizes.Length; i++)
                        {
                            bw.Write(imageBuffers[i]);
                        }
                    }

                    Console.WriteLine("Icon created successfully at: " + Path.GetFullPath(outputIco));
                    return 0;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error generating icon: " + ex.Message);
                Console.Error.WriteLine(ex.StackTrace);
                return 1;
            }
        }
    }
}
