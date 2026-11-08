// Stock imagery is illustrative; these are never delivery evidence URLs.
export function campaignImagery(title: string, placement: "card" | "detail" = "card") {
  if (/\blibrary\b/i.test(title)) {
    return { src: placement === "detail" ? "/images/campaign-books.jpg" : "/images/library.jpg", alt: placement === "detail" ? "Illustrative stack of colorful books for a reading space" : "Illustrative library shelves filled with books" };
  }
  if (/garden/i.test(title)) return { src: "/images/hero-growing.jpg", alt: "Illustrative growing plants" };
  if (/pantry/i.test(title)) return { src: "/images/impact-giving.jpg", alt: "Illustrative community giving" };
  if (/art room/i.test(title)) return { src: "/images/community-event.jpg", alt: "Illustrative community gathering" };
  if (/park cleanup/i.test(title)) return { src: "/images/community-volunteers.jpg", alt: "Illustrative volunteers carrying supplies" };
  return { src: "/images/community-volunteers.jpg", alt: "Illustrative volunteers carrying donated supplies" };
}
