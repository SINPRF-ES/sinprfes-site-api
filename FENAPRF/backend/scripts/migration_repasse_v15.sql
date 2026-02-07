-- Migration Repasse V15
CREATE TABLE IF NOT EXISTS repasse_mes (
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    per_capita DECIMAL(10, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (year, month)
);

CREATE TABLE IF NOT EXISTS repasse_lotacao (
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    lotacao_key TEXT NOT NULL,
    responsavel_id INTEGER REFERENCES users(id),
    prf_total INTEGER NOT NULL DEFAULT 0,
    reembolso_mes DECIMAL(10, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (year, month, lotacao_key),
    FOREIGN KEY (year, month) REFERENCES repasse_mes(year, month) ON DELETE CASCADE
);
