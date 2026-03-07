-- Migration v31: Enforce single current news for internal audience (Informes)

CREATE UNIQUE INDEX IF NOT EXISTS ux_noticias_interna_atual
  ON noticias (audiencia)
  WHERE audiencia = 'INTERNA' AND status_editorial = 'ATUAL';
