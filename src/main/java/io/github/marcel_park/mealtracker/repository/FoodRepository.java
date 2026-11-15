package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

import static io.github.marcel_park.mealtracker.repository.NamePatterns.at;

public interface FoodRepository extends JpaRepository<Food, Long> {

    // The foods the user may see (own ones and public ones), narrowed down by the filter flags.
    // At most one flag is set. namePatterns: one LIKE pattern per term of the search text, every one
    // must match the name (see CatalogSearch.namePatterns; empty: every name). eanCode: also finds
    // the foods with that EAN (null: none), even unconfirmed ones under confirmedOnly: whoever scans
    // a product wants that very product. pageable: which page of the sorted results, see
    // CatalogSearch.page.
    default List<Food> search(Long userId, List<String> namePatterns, String eanCode, boolean ownOnly,
                              boolean publicOnly, boolean confirmedOnly, Pageable pageable) {
        return searchByPatterns(userId, at(namePatterns, 0), at(namePatterns, 1), at(namePatterns, 2), at(namePatterns, 3),
                at(namePatterns, 4),
                eanCode, ownOnly, publicOnly, confirmedOnly, pageable);
    }

    // p1 to p5: the patterns, see NamePatterns.
    @Query("""
            select f from Food f left join f.owner o
            where (o is null or f.published = true or o.id = :userId)
              and (:ownOnly = false or o.id = :userId)
              and (:publicOnly = false or o is null or f.published = true)
              and (:confirmedOnly = false or f.confirmed = true or f.eanCode = :eanCode)
              and (((:p1 is null or lower(f.name) like :p1 escape '!')
              and (:p2 is null or lower(f.name) like :p2 escape '!')
              and (:p3 is null or lower(f.name) like :p3 escape '!')
              and (:p4 is null or lower(f.name) like :p4 escape '!')
              and (:p5 is null or lower(f.name) like :p5 escape '!'))
                  or f.eanCode = :eanCode)
            order by lower(f.name), f.id
            """)
    List<Food> searchByPatterns(@Param("userId") Long userId,
                             @Param("p1") String p1, @Param("p2") String p2, @Param("p3") String p3,
                             @Param("p4") String p4, @Param("p5") String p5,
                             @Param("eanCode") String eanCode,
                             @Param("ownOnly") boolean ownOnly,
                             @Param("publicOnly") boolean publicOnly,
                             @Param("confirmedOnly") boolean confirmedOnly,
                             Pageable pageable);

    // The same filters, without scope, among the given foods (the recently booked ones, see
    // FoodService.find). Unsorted: the caller keeps the order of ids.
    default List<Food> searchAmong(Long userId, Collection<Long> ids, List<String> namePatterns, String eanCode,
                                   boolean confirmedOnly) {
        return searchAmongByPatterns(userId, ids, at(namePatterns, 0), at(namePatterns, 1), at(namePatterns, 2), at(namePatterns, 3),
                at(namePatterns, 4),
                eanCode, confirmedOnly);
    }

    @Query("""
            select f from Food f left join f.owner o
            where f.id in :ids
              and (o is null or f.published = true or o.id = :userId)
              and (:confirmedOnly = false or f.confirmed = true or f.eanCode = :eanCode)
              and (((:p1 is null or lower(f.name) like :p1 escape '!')
              and (:p2 is null or lower(f.name) like :p2 escape '!')
              and (:p3 is null or lower(f.name) like :p3 escape '!')
              and (:p4 is null or lower(f.name) like :p4 escape '!')
              and (:p5 is null or lower(f.name) like :p5 escape '!'))
                  or f.eanCode = :eanCode)
            """)
    List<Food> searchAmongByPatterns(@Param("userId") Long userId,
                             @Param("ids") Collection<Long> ids,
                             @Param("p1") String p1, @Param("p2") String p2, @Param("p3") String p3,
                             @Param("p4") String p4, @Param("p5") String p5,
                             @Param("eanCode") String eanCode,
                             @Param("confirmedOnly") boolean confirmedOnly);
}
