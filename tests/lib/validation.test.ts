import { describe, expect, it } from "vitest";
import { orderFieldsSchema } from "@/lib/validation";

const valid = {
  name: "Mostafa Hassib",
  phone: "01012345678",
  email: "buyer@example.com",
  paymentMethod: "instapay",
  offerCode: "main",
  locale: "ar",
};

describe("orderFieldsSchema", () => {
  it("accepts a well-formed order", () => {
    expect(orderFieldsSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["01012345678", "01112345678", "01212345678", "01512345678"])(
    "accepts the Egyptian mobile prefix %s",
    (phone) => {
      expect(orderFieldsSchema.safeParse({ ...valid, phone }).success).toBe(true);
    },
  );

  it.each([
    ["too short", "0101234567"],
    ["too long", "010123456789"],
    ["wrong prefix", "01312345678"],
    ["not a mobile", "0221234567"],
    ["letters", "0101234567a"],
  ])("rejects a phone that is %s", (_label, phone) => {
    expect(orderFieldsSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });

  it("trims surrounding whitespace from the name", () => {
    const parsed = orderFieldsSchema.parse({ ...valid, name: "  Sara Ali  " });
    expect(parsed.name).toBe("Sara Ali");
  });

  it("rejects a name that is only whitespace", () => {
    expect(orderFieldsSchema.safeParse({ ...valid, name: "   " }).success).toBe(
      false,
    );
  });

  it("lowercases the email so duplicates collapse", () => {
    const parsed = orderFieldsSchema.parse({ ...valid, email: "A@Example.COM" });
    expect(parsed.email).toBe("a@example.com");
  });

  it("rejects a malformed email", () => {
    expect(
      orderFieldsSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("rejects an unknown payment method", () => {
    expect(
      orderFieldsSchema.safeParse({ ...valid, paymentMethod: "bitcoin" }).success,
    ).toBe(false);
  });

  it("rejects an unknown offer code", () => {
    expect(
      orderFieldsSchema.safeParse({ ...valid, offerCode: "free" }).success,
    ).toBe(false);
  });

  it("ignores an amount supplied by the client", () => {
    const parsed = orderFieldsSchema.parse({ ...valid, amount: 1 });
    expect(parsed).not.toHaveProperty("amount");
  });
});
