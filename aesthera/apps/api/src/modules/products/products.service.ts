import { AppError, NotFoundError } from '../../shared/errors/app-error'
import type { CreateProductDto, CreateSaleDto, ListProductsQuery, ListSalesQuery, UpdateProductDto } from './products.dto'
import { ProductsRepository } from './products.repository'

export class ProductsService {
  private repo = new ProductsRepository()

  async list(clinicId: string, q: ListProductsQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const product = await this.repo.findById(clinicId, id)
    if (!product) throw new NotFoundError('Product')
    return product
  }

  async create(clinicId: string, dto: CreateProductDto) {
    return this.repo.create(clinicId, dto)
  }

  async update(clinicId: string, id: string, dto: UpdateProductDto) {
    await this.get(clinicId, id)
    return this.repo.update(clinicId, id, dto)
  }

  async delete(clinicId: string, id: string) {
    await this.get(clinicId, id)
    await this.repo.softDelete(clinicId, id)
    return { message: 'Product deleted' }
  }

  async sell(clinicId: string, dto: CreateSaleDto) {
    const product = await this.get(clinicId, dto.productId)
    if (!product.active) throw new AppError('Product is inactive', 400, 'PRODUCT_INACTIVE')
    const unitPrice = dto.unitPrice ?? product.price
    if (product.stock < dto.quantity) {
      throw new AppError(`Estoque insuficiente. Disponível: ${product.stock} ${product.unit}`, 400, 'INSUFFICIENT_STOCK')
    }
    return this.repo.createSale(clinicId, dto, unitPrice)
  }

  async listSales(clinicId: string, q: ListSalesQuery) {
    return this.repo.listSales(clinicId, q)
  }
}
