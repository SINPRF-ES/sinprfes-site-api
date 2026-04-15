import { parseBirthdayContent, getBirthdayListSummary, sanitizeBirthdayHeading } from './birthdayContent';

describe('birthdayContent', () => {
  describe('parseBirthdayContent', () => {
    it('should parse basic birthday content correctly', () => {
      const content = `
### 🎂 Feliz aniversário!
SINPRF/ES celebra com alegria este dia especial.

---

### 🎊 Lista de aniversariantes
- 🎈 **João Silva** · Filiado(a)
- 🎈 **Maria Oliveira** · Dependente de José Oliveira
`;
      const result = parseBirthdayContent(content);
      expect(result.pessoas).toHaveLength(2);
      expect(result.pessoas[0]).toEqual({ nome: 'João Silva', subline: 'Filiado(a)' });
      expect(result.pessoas[1]).toEqual({ nome: 'Maria Oliveira', subline: 'Dependente de José Oliveira' });
    });

    it('should strip HTML tags and normalize content', () => {
      const content = '<div style="border:2px solid pink">### 🎂 Feliz aniversário!</div>';
      const result = parseBirthdayContent(content);
      // It should still find the heading and skip it
      expect(result.pessoas).toHaveLength(0);
    });

    it('should suppress decorative footer lines', () => {
      const content = `
- 🎈 **João Silva** · Filiado(a)
Cores inspiradas na bandeira do ES e clima de festa com balões, bolo e celebração coletiva.
`;
      const result = parseBirthdayContent(content);
      expect(result.pessoas).toHaveLength(1);
      expect(result.pessoas[0].nome).toBe('João Silva');
    });

    it('should handle different emoji prefixes', () => {
      const content = `
- 🎉 **Pessoa A**
- ✨ **Pessoa B**
- 🎁 **Pessoa C**
`;
      const result = parseBirthdayContent(content);
      expect(result.pessoas).toHaveLength(3);
      expect(result.pessoas[0].nome).toBe('Pessoa A');
      expect(result.pessoas[1].nome).toBe('Pessoa B');
      expect(result.pessoas[2].nome).toBe('Pessoa C');
    });

    it('should handle "Filiado(a)" on a new line', () => {
      const content = `
- 🎈 **João Silva**
Filiado(a)
`;
      const result = parseBirthdayContent(content);
      expect(result.pessoas).toHaveLength(1);
      expect(result.pessoas[0]).toEqual({ nome: 'João Silva', subline: 'Filiado(a)' });
    });
  });

  describe('getBirthdayListSummary', () => {
    it('should return a summary with the count of people', () => {
      const content = '- 🎈 **João**\n- 🎈 **Maria**';
      expect(getBirthdayListSummary(content)).toBe('Lista de aniversariantes do dia (2).');
    });

    it('should return generic summary if no people found', () => {
      expect(getBirthdayListSummary('')).toBe('Lista de aniversariantes do dia.');
    });
  });

  describe('sanitizeBirthdayHeading', () => {
    it('should clean the heading', () => {
      expect(sanitizeBirthdayHeading('🎉 Aniversariantes do dia 01/01/2026')).toBe('Aniversariantes do dia 01/01/2026');
    });
  });

  describe('edge cases', () => {
    it('should handle multi-line names or sublines correctly', () => {
      const content = `
- 🎈 **João Silva**
Filiado(a)
- 🎈 **Maria**
Dependente de José
`;
      const result = parseBirthdayContent(content);
      expect(result.pessoas).toHaveLength(2);
      expect(result.pessoas[0]).toEqual({ nome: 'João Silva', subline: 'Filiado(a)' });
      expect(result.pessoas[1]).toEqual({ nome: 'Maria', subline: 'Dependente de José' });
    });
  });
});
