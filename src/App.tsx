import { useState, useEffect } from "react"
import { ViewPage } from "@/pages/ViewPage"
import { EditPage } from "@/pages/EditPage"
import { AboutDialog } from "@/components/shared/AboutDialog"

const ABOUT_SEEN_KEY = "aboutSeen"

export default function App(): React.ReactElement {
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [aboutOpen, setAboutOpen] = useState(false)

  useEffect(function showAboutOnFirstVisit() {
    if (typeof localStorage === "undefined") return
    if (localStorage.getItem(ABOUT_SEEN_KEY) === null) {
      setAboutOpen(true)
    }
  }, [])

  function handleAboutClose(): void {
    setAboutOpen(false)
  }

  function handleAboutFirstClose(): void {
    try {
      localStorage.setItem(ABOUT_SEEN_KEY, "1")
    } catch {
      // ignore
    }
  }

  function handleOpenAbout(): void {
    setAboutOpen(true)
  }

  const isViewMode = mode === "view"

  return (
    <>
      <AboutDialog
        open={aboutOpen}
        onClose={handleAboutClose}
        onFirstClose={handleAboutFirstClose}
      />
      {isViewMode ? (
        <ViewPage onEditMode={() => setMode("edit")} onOpenAbout={handleOpenAbout} />
      ) : (
        <EditPage onViewMode={() => setMode("view")} onOpenAbout={handleOpenAbout} />
      )}
    </>
  )
}
