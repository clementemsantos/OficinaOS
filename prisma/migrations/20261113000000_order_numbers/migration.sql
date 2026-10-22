ALTER TABLE purchase_orders ADD COLUMN number SERIAL NOT NULL;
CREATE UNIQUE INDEX purchase_orders_number_key ON purchase_orders(number);
