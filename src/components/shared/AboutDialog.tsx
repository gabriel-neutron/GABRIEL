import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ABOUT_EN = {
  title: "About Gabriel",
  description: "Gabriel is a local military mapping application for annotating and visualizing hierarchical units on a map. It uses GeoPackage as the single source of truth and supports MIL-STD-2525-style symbols. The view shows a read-only demo project; switch to Edit mode to load and edit your own project file.",
}

const ABOUT_FR = {
  title: "À propos de Gabriel",
  description: "Gabriel est une application de cartographie militaire locale pour annoter et visualiser des unités hiérarchiques sur une carte. Elle utilise GeoPackage comme source de vérité unique et prend en charge les symboles de type MIL-STD-2525. La vue affiche un projet démo en lecture seule ; passez en mode Édition pour charger et modifier votre propre fichier de projet.",
}

const SOCIAL_LINKS = [
  { label: "Instagram", url: "https://www.instagram.com/gabriel__0x0/" },
  { label: "YouTube", url: "https://www.youtube.com/@Gabriel__0x0" },
  { label: "TikTok", url: "https://www.tiktok.com/@gabriel__0x0" },
] as const

type Props = {
  open: boolean
  onClose: () => void
  onFirstClose?: () => void
}

export function AboutDialog({ open, onClose, onFirstClose }: Props) {
  const [lang, setLang] = useState<"en" | "fr">("en")
  const hasMarkedSeenRef = useRef(false)

  const content = lang === "en" ? ABOUT_EN : ABOUT_FR

  function handleClose() {
    if (onFirstClose && !hasMarkedSeenRef.current) {
      onFirstClose()
      hasMarkedSeenRef.current = true
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <DialogContent className="z-[10000] max-w-lg text-black" showCloseButton>
        <DialogHeader className="text-left">
          <DialogTitle id="about-dialog-title" className="text-base font-semibold">
            {content.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
        <Tabs value={lang} onValueChange={(v) => setLang(v as "en" | "fr")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="en">English</TabsTrigger>
            <TabsTrigger value="fr">Français</TabsTrigger>
          </TabsList>
          <p className="mt-3 text-sm text-black">{content.description}</p>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {SOCIAL_LINKS.map((link) => (
            <Button key={link.label} variant="outline" size="sm" asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            </Button>
          ))}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
