import { z } from "zod";
import {
  emailField,
  idField,
  optionalId,
  optionalPhone,
  optionalText,
  passwordField,
  phoneField,
  requiredText,
  vehicleYearField,
  hmField,
  ymdField,
} from "./common";

export const contactSchema = z.object({
  name: requiredText("Name", 100),
  email: emailField,
  phone: optionalPhone,
  vehicle: optionalText(120),
  serviceInterest: optionalText(120),
  message: requiredText("Message", 2000).pipe(z.string().min(10, "Please add a few more details (10+ characters)")),
  // Honeypot — real users never fill this in.
  company: z.string().max(0).optional().or(z.literal("")),
});
export type ContactInput = z.input<typeof contactSchema>;

/** The configurable part of a job, shared by quotes and bookings. */
export const jobConfigSchema = z.object({
  serviceId: idField,
  optionId: optionalId,
  filmTypeId: optionalId,
  shade: z.coerce.number().int().min(1).max(100).optional().nullable(),
  vehicleTypeId: idField,
  vehicleSizeId: optionalId,
  addOnIds: z.array(idField).max(20).default([]),
});
export type JobConfig = z.output<typeof jobConfigSchema>;

export const contactDetailsSchema = z.object({
  name: requiredText("Name", 100),
  email: emailField,
  phone: phoneField,
});

export const vehicleDetailsSchema = z.object({
  vehicleYear: vehicleYearField,
  vehicleMake: requiredText("Make", 60),
  vehicleModel: requiredText("Model", 60),
});

export const quoteRequestSchema = z.object({
  config: jobConfigSchema,
  contact: contactDetailsSchema.extend(vehicleDetailsSchema.shape).extend({
    notes: optionalText(1500),
  }),
  company: z.string().max(0).optional().or(z.literal("")),
});
export type QuoteRequestInput = z.input<typeof quoteRequestSchema>;

export const quoteContactFormSchema = contactDetailsSchema.extend(vehicleDetailsSchema.shape).extend({
  notes: optionalText(1500),
});
export type QuoteContactForm = z.input<typeof quoteContactFormSchema>;

export const bookingSchema = z.object({
  config: jobConfigSchema,
  date: ymdField,
  time: hmField,
  technicianId: optionalId,
  contact: contactDetailsSchema,
  vehicle: vehicleDetailsSchema.extend({
    vehicleColor: optionalText(40),
    vehicleId: optionalId,
    saveVehicle: z.boolean().default(false),
  }),
  notes: optionalText(1500),
  paymentChoice: z.enum(["deposit", "full", "later"]),
  company: z.string().max(0).optional().or(z.literal("")),
});
export type BookingInput = z.input<typeof bookingSchema>;

export const bookingDetailsFormSchema = contactDetailsSchema.extend(vehicleDetailsSchema.shape).extend({
  vehicleColor: optionalText(40),
  notes: optionalText(1500),
});
export type BookingDetailsForm = z.input<typeof bookingDetailsFormSchema>;

export const availabilityQuerySchema = z.object({
  date: ymdField,
  serviceId: idField,
  duration: z.coerce.number().int().min(15).max(24 * 60),
  technicianId: optionalId,
  excludeAppointmentId: optionalId,
});

export const reviewSchema = z.object({
  name: requiredText("Name", 80),
  email: emailField.optional().or(z.literal("")).transform((v) => (v ? v : null)),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  title: optionalText(120),
  body: requiredText("Review", 2000).pipe(z.string().min(20, "Tell us a little more (20+ characters)")),
  vehicle: optionalText(80),
  appointmentId: optionalId,
  company: z.string().max(0).optional().or(z.literal("")),
});
export type ReviewInput = z.input<typeof reviewSchema>;

export const couponApplySchema = z.object({
  appointmentId: idField,
  token: z.string().max(128).optional().nullable(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Enter a code")
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, "Invalid code"),
});

export const checkoutSchema = z.object({
  appointmentId: idField,
  token: z.string().max(128).optional().nullable(),
  paymentType: z.enum(["DEPOSIT", "FULL", "BALANCE"]),
});

export const registerSchema = z
  .object({
    name: requiredText("Name", 100),
    email: emailField,
    phone: optionalPhone,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required").max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const vehicleSchema = z.object({
  year: vehicleYearField,
  make: requiredText("Make", 60),
  model: requiredText("Model", 60),
  color: optionalText(40),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[A-HJ-NPR-Z0-9]{17}$/.test(v), "VIN must be 17 characters (no I, O or Q)"),
  notes: optionalText(500),
  vehicleTypeId: optionalId,
  vehicleSizeId: optionalId,
});
export type VehicleInput = z.input<typeof vehicleSchema>;

export const profileSchema = z.object({
  name: requiredText("Name", 100),
  phone: optionalPhone,
  addressLine1: optionalText(120),
  addressLine2: optionalText(120),
  city: optionalText(80),
  state: optionalText(40),
  postalCode: optionalText(20),
  preferredContact: z.enum(["email", "phone", "sms"]).optional().nullable(),
  emailNotifications: z.boolean().default(true),
  smsOptIn: z.boolean().default(false),
  marketingOptIn: z.boolean().default(false),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(128).optional(),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const rescheduleSchema = z.object({
  appointmentId: idField,
  token: z.string().max(128).optional().nullable(),
  date: ymdField,
  time: hmField,
});

export const cancelSchema = z.object({
  appointmentId: idField,
  token: z.string().max(128).optional().nullable(),
  reason: optionalText(500),
});
