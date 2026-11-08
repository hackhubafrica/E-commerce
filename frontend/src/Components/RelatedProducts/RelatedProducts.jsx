import React, { useContext } from "react";
import './RelatedProducts.css'
import { ShopContext } from "../../Context/ShopContext";
import Item from "../Item/Item";


const RelatedProducts =({ productId }) =>{
    const { all_product } = useContext(ShopContext);
    const related = all_product.filter((product) => String(product.id) !== String(productId)).slice(0, 4);
    return(
        <div className="relatedproducts">
            <h1> Related products </h1>
            <hr />
            <div className="relatedproducts-item">
                {related.map((item) => {
                    return<Item
                            key={item.id}
                            id={item.id}
                            name={item.name}
                            image={item.image}
                            new_price={item.new_price}
                            old_price={item.old_price}
                            />
                })}
            </div>
        </div>
    )
}

export default RelatedProducts