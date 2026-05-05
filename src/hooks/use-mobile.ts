import * as React from "react"

const MOBILE_BREAKPOINT = 992

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const widthMql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(widthMql.matches)

    widthMql.addEventListener("change", onChange)
    onChange()
    return () => widthMql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
