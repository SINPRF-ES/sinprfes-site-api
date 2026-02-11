# Bolt Journal - FENAPRF Performance Insights

- **SQL Normalization**: Used `regexp_replace(column, '[^0-9]', '', 'g')` for high-performance digit extraction in PostgreSQL, replacing multiple nested `REPLACE` calls.
- **Dependency Management**: Backend requires full `npm install` to run tests successfully due to external dependencies like `pdfkit`, `pg`, and `uuid`.
