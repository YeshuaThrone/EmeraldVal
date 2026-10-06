export interface DecodedVarInt {
  value: number;
  bytesRead: number;
}

export class VarIntProtocol {
  /**
   * Reads a VarInt from a Node.js Buffer at a specified byte offset.
   * VarInts use 7 bits per byte for payload and 1 bit (MSB) as a continuation flag.
   */
  public static readVarInt(buffer: Buffer, offset = 0): DecodedVarInt {
    let value = 0;
    let bytesRead = 0;
    let currentByte = 0;

    do {
      if (offset + bytesRead >= buffer.length) {
        throw new RangeError("[VarInt] Buffer underflow while reading VarInt.");
      }

      currentByte = buffer[offset + bytesRead]!;
      const payload = currentByte & 0x7f; // Extract lower 7 bits
      value |= payload << (7 * bytesRead);

      bytesRead++;

      if (bytesRead > 5) {
        throw new Error(
          "[VarInt] VarInt exceeds maximum allowed size of 5 bytes (32-bit integer limit).",
        );
      }
    } while ((currentByte & 0x80) !== 0); // Continue if Continuation Bit (0x80) is set

    return { value, bytesRead };
  }

  /**
   * Encodes a 32-bit signed integer into a VarInt Buffer payload.
   */
  public static writeVarInt(value: number): Buffer {
    const bytes: number[] = [];
    let unsignedVal = value >>> 0; // Convert to 32-bit unsigned integer

    while (true) {
      if ((unsignedVal & ~0x7f) === 0) {
        bytes.push(unsignedVal);
        break;
      }

      // Set MSB continuation bit (0x80) on current byte
      bytes.push((unsignedVal & 0x7f) | 0x80);
      unsignedVal >>>= 7;
    }

    return Buffer.from(bytes);
  }

  /**
   * Frames a network packet payload by prepending its VarInt byte length header.
   */
  public static createPacket(packetId: number, data: Buffer): Buffer {
    const packetIdBuffer = VarIntProtocol.writeVarInt(packetId);
    const payload = Buffer.concat([packetIdBuffer, data]);
    const lengthHeader = VarIntProtocol.writeVarInt(payload.length);

    return Buffer.concat([lengthHeader, payload]);
  }
}
