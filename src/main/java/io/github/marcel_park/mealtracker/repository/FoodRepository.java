package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface FoodRepository extends JpaRepository<Food, Long> {

    // The foods the user may see (own ones and public ones), narrowed down by the filter flags.
    // At most one flag is set. namePattern is a LIKE pattern in lower case with '!' as escape
    // character, see SearchPattern. eanCode: also finds the foods with that EAN (null: none), even
    // unconfirmed ones under confirmedOnly: whoever scans a product wants that very product.
    // pageable: which page of the sorted results, see CatalogSearch.page.
    @Query("""
            select f from Food f left join f.owner o
            where (o is null or f.published = true or o.id = :userId)
              and (:ownOnly = false or o.id = :userId)
              and (:publicOnly = false or o is null or f.published = true)
              and (:confirmedOnly = false or f.confirmed = true or f.eanCode = :eanCode)
              and (lower(f.name) like :namePattern escape '!' or f.eanCode = :eanCode)
            order by lower(f.name), f.id
            """)
    List<Food> search(@Param("userId") Long userId,
                      @Param("namePattern") String namePattern,
                      @Param("eanCode") String eanCode,
                      @Param("ownOnly") boolean ownOnly,
                      @Param("publicOnly") boolean publicOnly,
                      @Param("confirmedOnly") boolean confirmedOnly,
                      Pageable pageable);

    // The same filters, without scope, among the given foods (the recently booked ones, see
    // FoodService.find). Unsorted: the caller keeps the order of ids.
    @Query("""
            select f from Food f left join f.owner o
            where f.id in :ids
              and (o is null or f.published = true or o.id = :userId)
              and (:confirmedOnly = false or f.confirmed = true or f.eanCode = :eanCode)
              and (lower(f.name) like :namePattern escape '!' or f.eanCode = :eanCode)
            """)
    List<Food> searchAmong(@Param("userId") Long userId,
                           @Param("ids") Collection<Long> ids,
                           @Param("namePattern") String namePattern,
                           @Param("eanCode") String eanCode,
                           @Param("confirmedOnly") boolean confirmedOnly);
}
