import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PricingCatalog } from "@/lib/pricing/engine";
import { CACHE_TAGS } from "./settings";

// Cached loaders return JSON-safe data (unstable_cache serializes results).

const loadPricingCatalog = unstable_cache(
  async (): Promise<PricingCatalog> => {
    const [services, options, films, vehicleTypes, vehicleSizes, rules] = await Promise.all([
      prisma.service.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          category: true,
          usesFilm: true,
          filmTypeId: true,
          parentId: true,
          startingPrice: true,
          durationMinutes: true,
          depositAmount: true,
          bookable: true,
          imageUrl: true,
          shortDescription: true,
        },
      }),
      prisma.serviceOption.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, serviceId: true, name: true, description: true, kind: true, windowCount: true, durationMinutes: true, price: true },
      }),
      prisma.filmType.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, tagline: true, shades: true, heatRejection: true, uvRejection: true },
      }),
      prisma.vehicleType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true, description: true } }),
      prisma.vehicleSize.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, description: true, priceAdjustPercent: true, durationAdjustPercent: true },
      }),
      prisma.pricingRule.findMany({
        where: { active: true },
        select: {
          id: true,
          serviceId: true,
          serviceOptionId: true,
          filmTypeId: true,
          vehicleTypeId: true,
          vehicleSizeId: true,
          price: true,
          pricePerWindow: true,
          durationMinutes: true,
          priority: true,
        },
      }),
    ]);
    return { services, options, films, vehicleTypes, vehicleSizes, rules };
  },
  ["pricing-catalog"],
  { tags: [CACHE_TAGS.catalog], revalidate: 3600 },
);

export const getPricingCatalog = cache(() => loadPricingCatalog());

/** Uncached catalog for authoritative server-side calculations (checkout, booking). */
export async function getFreshPricingCatalog(): Promise<PricingCatalog> {
  return loadPricingCatalogUncached();
}

async function loadPricingCatalogUncached(): Promise<PricingCatalog> {
  const [services, options, films, vehicleTypes, vehicleSizes, rules] = await Promise.all([
    prisma.service.findMany({ where: { active: true } }),
    prisma.serviceOption.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }] }),
    prisma.filmType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.vehicleType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.vehicleSize.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.pricingRule.findMany({ where: { active: true } }),
  ]);
  return { services, options, films, vehicleTypes, vehicleSizes, rules };
}

const serviceCardSelect = {
  id: true,
  slug: true,
  name: true,
  category: true,
  tagline: true,
  shortDescription: true,
  imageUrl: true,
  startingPrice: true,
  durationMinutes: true,
  durationLabel: true,
  featured: true,
  bookable: true,
} as const;

const loadServices = unstable_cache(
  async () =>
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: serviceCardSelect,
    }),
  ["services-list"],
  { tags: [CACHE_TAGS.catalog], revalidate: 3600 },
);

export const getServices = cache(() => loadServices());
export type ServiceCard = Awaited<ReturnType<typeof loadServices>>[number];

const loadServiceBySlug = unstable_cache(
  async (slug: string) => {
    const service = await prisma.service.findFirst({
      where: { slug, active: true },
      include: {
        filmType: { select: { id: true, name: true, slug: true } },
        parent: { select: { id: true, name: true, slug: true } },
        faqs: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, question: true, answer: true } },
      },
    });
    if (!service) return null;
    const optionSourceId = service.parentId ?? service.id;
    const options = await prisma.serviceOption.findMany({
      where: { serviceId: optionSourceId, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true, kind: true, windowCount: true, durationMinutes: true, price: true },
    });
    const { createdAt: _c, updatedAt: _u, ...rest } = service;
    return { ...rest, options };
  },
  ["service-by-slug"],
  { tags: [CACHE_TAGS.catalog], revalidate: 3600 },
);

export const getServiceBySlug = cache((slug: string) => loadServiceBySlug(slug));
export type ServiceDetail = NonNullable<Awaited<ReturnType<typeof loadServiceBySlug>>>;

const loadFilmTypes = unstable_cache(
  async () =>
    prisma.filmType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        description: true,
        heatRejection: true,
        uvRejection: true,
        glareReduction: true,
        warrantyYears: true,
        shades: true,
        features: true,
      },
    }),
  ["film-types"],
  { tags: [CACHE_TAGS.catalog], revalidate: 3600 },
);

export const getFilmTypes = cache(() => loadFilmTypes());
export type FilmTypeCard = Awaited<ReturnType<typeof loadFilmTypes>>[number];

const loadPackages = unstable_cache(
  async () =>
    prisma.package.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        description: true,
        price: true,
        priceSuffix: true,
        features: true,
        recommendedFor: true,
        highlighted: true,
        serviceId: true,
        serviceOptionId: true,
        filmTypeId: true,
        service: { select: { slug: true } },
      },
    }),
  ["packages"],
  { tags: [CACHE_TAGS.catalog], revalidate: 3600 },
);

export const getPackages = cache(() => loadPackages());
export type PackageCard = Awaited<ReturnType<typeof loadPackages>>[number];

const loadGeneralFaqs = unstable_cache(
  async () =>
    prisma.faq.findMany({
      where: { active: true, serviceId: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, question: true, answer: true },
    }),
  ["general-faqs"],
  { tags: [CACHE_TAGS.catalog], revalidate: 3600 },
);

export const getGeneralFaqs = cache(() => loadGeneralFaqs());

const loadGallery = unstable_cache(
  async () => {
    const rows = await prisma.galleryImage.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        caption: true,
        alt: true,
        imageUrl: true,
        beforeImageUrl: true,
        width: true,
        height: true,
        categories: true,
        vehicle: true,
        featured: true,
      },
    });
    return rows;
  },
  ["gallery"],
  { tags: [CACHE_TAGS.gallery], revalidate: 3600 },
);

export const getGallery = cache(() => loadGallery());
export type GalleryItem = Awaited<ReturnType<typeof loadGallery>>[number];

const loadReviews = unstable_cache(
  async () => {
    const [reviews, stats] = await Promise.all([
      prisma.review.findMany({
        where: { status: "APPROVED" },
        orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        take: 60,
        select: { id: true, name: true, rating: true, title: true, body: true, vehicle: true, featured: true, adminReply: true, createdAt: true, publishedAt: true },
      }),
      prisma.review.aggregate({ where: { status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } }),
    ]);
    return {
      reviews: reviews.map((r) => ({ ...r, createdAt: (r.publishedAt ?? r.createdAt).toISOString(), publishedAt: undefined })),
      average: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : null,
      count: stats._count._all,
    };
  },
  ["approved-reviews"],
  { tags: [CACHE_TAGS.reviews], revalidate: 3600 },
);

export const getApprovedReviews = cache(() => loadReviews());
export type PublicReview = Awaited<ReturnType<typeof loadReviews>>["reviews"][number];

const loadLegalPage = unstable_cache(
  async (slug: string) => {
    const page = await prisma.legalPage.findUnique({ where: { slug } });
    return page ? { slug: page.slug, title: page.title, content: page.content, updatedAt: page.updatedAt.toISOString() } : null;
  },
  ["legal-page"],
  { tags: [CACHE_TAGS.legal], revalidate: 3600 },
);

export const getLegalPage = cache((slug: string) => loadLegalPage(slug));

export const LEGAL_SLUGS = [
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "terms", title: "Terms of Service" },
  { slug: "cancellation", title: "Cancellation Policy" },
  { slug: "refund", title: "Refund Policy" },
  { slug: "warranty", title: "Warranty Policy" },
] as const;

export const getTechniciansPublic = cache(async () =>
  prisma.technician.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, title: true, bio: true, avatarUrl: true, services: { select: { id: true } } },
  }),
);
