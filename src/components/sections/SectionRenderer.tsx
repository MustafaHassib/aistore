import { SECTIONS, type SectionEntry } from "@/config/sections";
import { BeforeAfter } from "./BeforeAfter";
import { CardGrid } from "./CardGrid";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Hero } from "./Hero";
import { HeroStats } from "./HeroStats";
import { MediaGrid } from "./MediaGrid";
import { OfferStack } from "./OfferStack";
import { OrderSection } from "./OrderSection";

function renderSection(section: SectionEntry) {
  const { id, kind, namespace, columns, band } = section;

  switch (kind) {
    case "hero":
      return <Hero key={id} />;
    case "heroStats":
      return <HeroStats key={id} />;
    case "cardGrid":
      return (
        <CardGrid
          key={id}
          id={id}
          namespace={namespace!}
          columns={(columns ?? 3) as 2 | 3 | 4}
          band={band}
        />
      );
    case "mediaGrid":
      return (
        <MediaGrid
          key={id}
          id={id}
          namespace={namespace!}
          columns={(columns ?? 3) as 1 | 2 | 3}
          band={band}
        />
      );
    case "beforeAfter":
      return <BeforeAfter key={id} id={id} namespace={namespace!} band={band} />;
    case "offerStack":
      return <OfferStack key={id} id={id} namespace={namespace!} band={band} />;
    case "order":
      return <OrderSection key={id} id={id} namespace={namespace!} band={band} />;
    case "faq":
      return <Faq key={id} id={id} namespace={namespace!} band={band} />;
    case "finalCta":
      return <FinalCta key={id} />;
  }
}

export function SectionRenderer() {
  return <>{SECTIONS.map(renderSection)}</>;
}
