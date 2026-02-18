# Padrões de Layout Mobile (iOS Safari / PWA)

Este documento define as diretrizes para garantir uma experiência mobile estável, especialmente em iOS Safari e quando instalado como PWA.

## 1. Header e Posicionamento

### Padrão Escolhido: Sticky
Preferimos `position: sticky; top: 0;` para headers em vez de `fixed`.

- **Por que?** Evita bugs de posicionamento do iOS Safari quando o teclado virtual é aberto ou quando a barra de endereços retrai/expande. Além disso, o conteúdo flui naturalmente abaixo do header sem necessidade de compensação manual de padding/margin no body.
- **Implementação:**
  ```css
  #site-header {
    position: sticky;
    top: 0;
    z-index: 2000;
    background: var(--azul-fundo); /* Fundo sólido obrigatório */
  }
  ```

### Safe Areas (iPhone Notch)
Sempre considere as áreas seguras do dispositivo:
```css
.header-content {
  padding-top: calc(10px + env(safe-area-inset-top, 0px));
}
```

## 2. Rolagem (Scroll)

### Regras de Ouro
1. **Evitar `100vh`:** Use `min-height: 100dvh` (Dynamic Viewport Height) com fallback para `100vh`. Isso evita que o conteúdo seja cortado ou que apareçam barras de rolagem duplas no iOS.
2. **Priorizar Scroll na Raiz:** Sempre que possível, deixe o `html` e `body` rolarem naturalmente. Evite containers com `height: 100vh; overflow: auto;` (nested scroll) no mobile.
3. **Não use `overflow: hidden` no Body:** Isso quebra o comportamento nativo do iOS e pode impedir o funcionamento correto do teclado.

### Scroll Lock para Modais
Para travar a rolagem ao abrir modais/menus no iOS sem causar "saltos", use a técnica de `position: fixed` no body:

```javascript
// Exemplo disponível em Utils
// Variável de controle (closure ou global)
let scrollPosition = 0;

function lockScroll() {
  scrollPosition = window.pageYOffset;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollPosition}px`;
  document.body.style.width = '100%';
}

function unlockScroll() {
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('width');
  window.scrollTo(0, scrollPosition);
}
```

## 3. Âncoras e Links Internos
Ao usar headers sticky/fixed, as âncoras (`#secao`) podem ficar escondidas sob o header. Use `scroll-margin-top` para compensar:

```css
[id]:target {
  scroll-margin-top: calc(var(--header-h) + 20px);
}
```

## 4. Anti-Patterns (O que NÃO fazer)
- **NÃO** use `padding-top` fixo no `body` para compensar o header (isso quebra se o header mudar de altura).
- **NÃO** use `width: 100vw` em elementos com padding (causa overflow horizontal). Prefira `width: 100%` com `box-sizing: border-box`.
- **NÃO** use listeners de scroll pesados sem `passive: true`.
