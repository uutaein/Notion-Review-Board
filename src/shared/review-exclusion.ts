export interface ExcludeReviewItemInputDto {
  reviewItemId: string
}

export interface ExcludeReviewItemResultDto {
  itemId: string
  status: 'archived'
  excludedAt: string
}
