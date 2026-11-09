package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FoodRepository extends JpaRepository<Food, Long> {

    // The foods the user may see (own ones and public ones), narrowed down by the filter flags.
    // At most one flag is set. namePattern is a LIKE pattern in lower case with '!' as escape
    // character, see SearchPattern.
    @Query("""
            select f from Food f left join f.owner o
            where (o is null or f.published = true or o.id = :userId)
              and (:ownOnly = false or o.id = :userId)
              and (:publicOnly = false or o is null or f.published = true)
              and (:confirmedOnly = false or f.confirmed = true)
              and lower(f.name) like :namePattern escape '!'
            order by lower(f.name), f.id
            """)
    List<Food> search(@Param("userId") Long userId,
                      @Param("namePattern") String namePattern,
                      @Param("ownOnly") boolean ownOnly,
                      @Param("publicOnly") boolean publicOnly,
                      @Param("confirmedOnly") boolean confirmedOnly);
}
