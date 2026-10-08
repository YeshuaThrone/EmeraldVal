import { describe, expect, it } from "vitest";
import { VarIntProtocol } from "./varIntProtocol";

describe("VarIntProtocol", () => {
  it("round-trips 7-bit values and continuation bytes", () => {
    expect(VarIntProtocol.writeVarInt(0)).toEqual(Buffer.from([0x00]));
    expect(VarIntProtocol.writeVarInt(127)).toEqual(Buffer.from([0x7f]));
    expect(VarIntProtocol.writeVarInt(128)).toEqual(Buffer.from([0x80, 0x01]));
    expect(VarIntProtocol.writeVarInt(255)).toEqual(Buffer.from([0xff, 0x01]));

    for (const value of [0, 1, 127, 128, 255, 2097151, 2147483647]) {
      const encoded = VarIntProtocol.writeVarInt(value);
      const decoded = VarIntProtocol.readVarInt(encoded);
      expect(decoded.value).toBe(value);
      expect(decoded.bytesRead).toBe(encoded.length);
    }
  });

  it("frames a packet as length VarInt + packet id VarInt + data", () => {
    const data = Buffer.from([0xde, 0xad]);
    const packet = VarIntProtocol.createPacket(0x00, data);
    const length = VarIntProtocol.readVarInt(packet);
    const packetId = VarIntProtocol.readVarInt(packet, length.bytesRead);
    const payload = packet.subarray(length.bytesRead + packetId.bytesRead);
    expect(length.value).toBe(packetId.bytesRead + data.length);
    expect(packetId.value).toBe(0);
    expect(payload).toEqual(data);
  });

  it("throws on buffer underflow and on VarInts longer than 5 bytes", () => {
    expect(() => VarIntProtocol.readVarInt(Buffer.from([0x80]))).toThrow(
      /Buffer underflow/,
    );
    expect(() =>
      VarIntProtocol.readVarInt(Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x01])),
    ).toThrow(/exceeds maximum allowed size of 5 bytes/);
  });
});
