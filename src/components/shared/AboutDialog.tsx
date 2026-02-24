import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ABOUT_EN = {
  title: "About Gabriel",
  description:
    "Gabriel is a local military mapping application for annotating and visualizing hierarchical units on a map. " +
    "It uses GeoPackage as the single source of truth and supports MIL-STD-2525-style symbols. " +
    "The view shows a read-only demo project; switch to Edit mode to load and edit your own project file.",
  links: "Follow the project",
}

const ABOUT_FR = {
  title: "À propos de Gabriel",
  description:
    "Gabriel est une application de cartographie militaire locale pour annoter et visualiser des unités hiérarchiques sur une carte. " +
    "Elle utilise GeoPackage comme source de vérité unique et prend en charge les symboles de type MIL-STD-2525. " +
    "La vue affiche un projet démo en lecture seule ; passez en mode Édition pour charger et modifier votre propre fichier de projet.",
  links: "Suivre le projet",
}

const SOCIAL_LINKS = [
  { label: "Instagram", url: "https://www.instagram.com/gabriel__0x0/", key: "instagram" },
  { label: "YouTube", url: "https://www.youtube.com/@Gabriel__0x0", key: "youtube" },
  { label: "TikTok", url: "https://www.tiktok.com/@gabriel__0x0", key: "tiktok" },
] as const

type Props = {
  open: boolean
  onClose: () => void
  onFirstClose?: () => void
}

export function AboutDialog({ open, onClose, onFirstClose }: Props) {
  const [lang, setLang] = useState<"en" | "fr">("en")
  const [hasMarkedSeen, setHasMarkedSeen] = useState(false)

  if (!open) return null

  const content = lang === "en" ? ABOUT_EN : ABOUT_FR

  function handleClose() {
    if (onFirstClose && !hasMarkedSeen) {
      onFirstClose()
      setHasMarkedSeen(true)
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-dialog-title"
    >
      <Card className="relative w-full max-w-lg border bg-card shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle id="about-dialog-title">{content.title}</CardTitle>
          <Button size="sm" variant="ghost" onClick={handleClose} aria-label="Close">
            Close
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={lang} onValueChange={(v) => setLang(v as "en" | "fr")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="fr">Français</TabsTrigger>
            </TabsList>
            <div className="mt-3 text-sm text-muted-foreground">
              <p>{content.description}</p>
            </div>
          </Tabs>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">{content.links}</div>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_LINKS.map((link) => (
                <Button
                  key={link.key}
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
