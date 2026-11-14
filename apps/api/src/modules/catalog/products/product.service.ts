/** Routes product reads and changes to their responsible operation. */
import { Inject, Injectable } from '@nestjs/common';
import type { CatalogProductModifierGroupAssignmentFields, CursorPage } from '@waffarly/contracts';

import { type CursorPageQuery } from '../../../common/http/pagination.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { toProductResponse } from './product.mapper.js';

import type { ProductInput, ProductPatch } from './product.types.js';
import { listProducts, getProduct } from './queries/product-queries.js';
import { createProduct } from './commands/create-product.js';
import { updateProduct } from './commands/update-product.js';
import { attachModifierGroup, detachModifierGroup } from './commands/product-modifier-links.js';

import { archiveProduct, restoreProduct, removeProduct } from './commands/product-availability.js';

@Injectable()
export class ProductService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(
    merchantId: string,
    page: CursorPageQuery = { limit: 50 },
  ): Promise<CursorPage<ReturnType<typeof toProductResponse>>> {
    return listProducts(this.prisma, merchantId, page);
  }

  async create(merchantId: string, actor: string, input: ProductInput) {
    return createProduct(this.prisma, merchantId, actor, input);
  }

  async update(
    merchantId: string,
    actor: string,
    id: string,
    revision: number,
    input: ProductPatch,
  ) {
    return updateProduct(this.prisma, merchantId, actor, id, revision, input);
  }

  async attachModifierGroup(
    merchantId: string,
    actor: string,
    productId: string,
    revision: number,
    assignment: CatalogProductModifierGroupAssignmentFields,
  ) {
    return attachModifierGroup(this.prisma, merchantId, actor, productId, revision, assignment);
  }

  async detachModifierGroup(
    merchantId: string,
    actor: string,
    productId: string,
    assignmentId: string,
    revision: number,
  ) {
    return detachModifierGroup(this.prisma, merchantId, actor, productId, assignmentId, revision);
  }

  async archive(merchantId: string, actor: string, id: string, revision: number) {
    return archiveProduct(this.prisma, merchantId, actor, id, revision);
  }

  async restore(merchantId: string, actor: string, id: string, revision: number) {
    return restoreProduct(this.prisma, merchantId, actor, id, revision);
  }

  async remove(merchantId: string, id: string) {
    return removeProduct(this.prisma, merchantId, id);
  }

  async get(merchantId: string, id: string) {
    return getProduct(this.prisma, merchantId, id);
  }
}
