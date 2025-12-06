import React from 'react';
import ProductGroupTable from './ProductGroupTable';
import './TableDetailStyles.css';

/**
 * ProductGroupDetail Component
 * ----------------------------
 * Displays the Product Groups table in the Divisional Dashboard overlay.
 */
const ProductGroupDetail = () => {
  return (
    <div className="table-detail">
      <div className="table-detail__wrapper">
        <ProductGroupTable hideHeader={true} />
      </div>
    </div>
  );
};

export default ProductGroupDetail;

