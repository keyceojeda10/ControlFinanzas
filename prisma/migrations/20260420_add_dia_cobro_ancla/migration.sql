-- Agrega dia ancla opcional para fijar dia de cobro en prestamos semanales/quincenales/mensuales
ALTER TABLE `Prestamo`
  ADD COLUMN `diaCobroSemana` INT NULL,
  ADD COLUMN `diaCobroMes` INT NULL;
