package repository

import "gorm.io/gorm"

// TxDB 事务 DB 别名，用于在 Transaction 回调中传递
type TxDB = gorm.DB
