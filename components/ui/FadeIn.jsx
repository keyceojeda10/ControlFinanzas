// components/ui/FadeIn.jsx
// Wrapper que aplica un crossfade suave cuando el contenido real
// reemplaza al skeleton/loading state.
//
// Uso:
//   {loading ? <SkeletonCard /> : (
//     <FadeIn>
//       <ContenidoReal />
//     </FadeIn>
//   )}
//
// O con control de visibilidad via prop show:
//   <FadeIn show={!loading}>
//     <ContenidoReal />
//   </FadeIn>
//
// Props:
//   show      - cuando es false no renderiza nada (default true)
//   duration  - duracion de la transicion en ms (default 300) — informativo,
//               la duracion real la controla la clase CSS fade-in-content
//   className - clases adicionales para el contenedor
//   as        - tag HTML del contenedor (default 'div')

export function FadeIn({
  show = true,
  duration = 300,
  className = '',
  as: Tag = 'div',
  children,
}) {
  if (!show) return null

  return (
    <Tag
      className={['fade-in-content', className].filter(Boolean).join(' ')}
      style={duration !== 300 ? { animationDuration: `${duration}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
