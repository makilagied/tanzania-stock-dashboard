import { SeoIntroFunds } from "@/components/seo-intro"
import FundsPageClient from "./funds-page-client"

export default function FundsPage() {
  return <FundsPageClient seoIntro={<SeoIntroFunds />} />
}
