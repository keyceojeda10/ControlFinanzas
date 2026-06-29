// components/ui/StaggeredList.jsx
// Envuelve una lista de items y aplica animaciones escalonadas (stagger) a cada
// hijo directo via la custom property CSS --stagger-delay.
//
// Uso:
//   <StaggeredList>
//     {items.map(item => <Card key={item.id}>...</Card>)}
//   </StaggeredList>
//
// Props:
//   baseDelay   - segundos de delay para el primer item (default 0.03s)
//   step        - incremento de delay entre items en segundos (default 0.06s)
//   className   - clases adicionales para el contenedor
//   as          - tag HTML del contenedor (default 'div')

import { Children, cloneElement, isValidElement } from 'react'

export function StaggeredList({
  children,
  baseDelay = 0.03,
  step = 0.06,
  className = '',
  as: Tag = 'div',
}) {
  const items = Children.toArray(children)

  return (
    <Tag className={className}>
      {items.map((child, index) => {
        if (!isValidElement(child)) return child

        const delay = baseDelay + index * step
        const existingStyle = child.props.style ?? {}
        const existingClassName = child.props.className ?? ''

        return cloneElement(child, {
          key: child.key ?? index,
          className: [existingClassName, 'stagger-item'].filter(Boolean).join(' '),
          style: {
            ...existingStyle,
            '--stagger-delay': `${delay.toFixed(3)}s`,
          },
        })
      })}
    </Tag>
  )
}
