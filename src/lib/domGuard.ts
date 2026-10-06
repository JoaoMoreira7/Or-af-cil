/**
 * Patch defensivo global para manipulação de nós no DOM.
 *
 * Previne falhas fatais no React ("NotFoundError: Failed to execute 'insertBefore' on 'Node'"
 * e "NotFoundError: Failed to execute 'removeChild' on 'Node'") causadas por extensões de
 * navegador (ex.: tradutores automáticos, gerenciadores de senha), remoções assíncronas de
 * portais/toasts ou reconciliações concorrentes de DOM onde o nó de referência foi desanexado.
 */
export function instalarBlindagemDOM(): void {
  if (typeof window === 'undefined' || typeof Node === 'undefined') {
    return
  }

  // Evita reaplicar a blindagem se já estiver instalada
  const marker = '__orcafacil_dom_guard_installed__'
  if ((window as unknown as Record<string, unknown>)[marker]) {
    return
  }
  ;(window as unknown as Record<string, unknown>)[marker] = true

  const originalInsertBefore = Node.prototype.insertBefore
  const originalRemoveChild = Node.prototype.removeChild

  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    // Se não há nó de referência ou ele realmente é filho do nó atual, usa a implementação nativa
    if (!referenceNode || referenceNode.parentNode === this) {
      try {
        return originalInsertBefore.call(this, newNode, referenceNode) as T
      } catch (err) {
        // Se ainda assim falhar por NotFoundError, faz fallback para appendChild
        if (err instanceof DOMException && err.name === 'NotFoundError') {
          return this.appendChild(newNode) as T
        }
        throw err
      }
    }

    // Se o nó de referência não for filho deste elemento (desalinhamento pós-desmonte/tradução):
    // Faz fallback seguro inserindo no final (appendChild) em vez de estourar exceção fatal.
    return this.appendChild(newNode) as T
  }

  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    // Se o elemento não for mais filho deste nó, degrada graciosamente sem estourar NotFoundError
    if (child.parentNode !== this) {
      if (child.parentNode) {
        try {
          return originalRemoveChild.call(child.parentNode, child) as T
        } catch {
          return child
        }
      }
      return child
    }

    try {
      return originalRemoveChild.call(this, child) as T
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        return child
      }
      throw err
    }
  }
}
