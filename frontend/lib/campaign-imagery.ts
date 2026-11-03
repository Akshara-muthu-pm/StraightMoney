// Stock imagery is illustrative; these are never delivery evidence URLs.
export function campaignImagery(title: string, placement: "card" | "detail" = "card") {
  return /\blibrary\b/i.test(title)
    ? { src: placement === "detail" ? "/images/campaign-books.jpg" : "/images/library.jpg", alt: placement === "detail" ? "Illustrative stack of colorful books for a reading space" : "Illustrative library shelves filled with books" }
    : { src: "/images/community-volunteers.jpg", alt: "Illustrative volunteers carrying donated supplies" };
}
